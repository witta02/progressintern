package handlers

import (
	"database/sql"
	"internship-backend/config"
	"internship-backend/models"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ========================================================
// 🏫 SCHOOL MANAGEMENT HANDLERS
// ========================================================

// GetAllSchoolsHandler returns all schools ordered by name
func GetAllSchoolsHandler(c *gin.Context) {
	rows, err := config.DB.Query("SELECT id, name, created_at FROM schools ORDER BY name ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ดึงข้อมูลสถานศึกษาล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var schools []models.School
	for rows.Next() {
		var s models.School
		if err := rows.Scan(&s.ID, &s.Name, &s.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "การอ่านข้อมูลสถานศึกษาผิดพลาด: " + err.Error()})
			return
		}
		schools = append(schools, s)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ดึงข้อมูลสถานศึกษาสำเร็จ",
		"data":    schools,
	})
}

// CreateSchoolHandler adds a new school to the database
func CreateSchoolHandler(c *gin.Context) {
	var input models.CreateSchoolInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "กรุณาระบุชื่อสถานศึกษาที่ถูกต้อง"})
		return
	}

	name := strings.TrimSpace(input.Name)
	result, err := config.DB.Exec("INSERT INTO schools (name) VALUES (?)", name)
	if err != nil {
		if strings.Contains(err.Error(), "1062") || strings.Contains(err.Error(), "Duplicate entry") {
			c.JSON(http.StatusConflict, gin.H{"status": 409, "error": "มีสถานศึกษานี้อยู่ในระบบแล้ว"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ไม่สามารถเพิ่มสถานศึกษาได้: " + err.Error()})
		}
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{
		"status":  201,
		"message": "เพิ่มสถานศึกษาสำเร็จ",
		"data": gin.H{
			"id":         id,
			"name":       name,
			"created_at": time.Now(),
		},
	})
}

// ========================================================
// 🔐 ENROLLMENT CODE MANAGEMENT HANDLERS
// ========================================================

// GetAllCodesHandler returns all generated enrollment/invite codes
func GetAllCodesHandler(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT ec.id, ec.school_id, COALESCE(s.name, '-') as school_name, ec.role, ec.code, ec.max_uses, ec.used_count, ec.expires_at, ec.is_active,
		       ec.company_id, COALESCE(c.company_name, ec.company_name, ''), COALESCE(c.address, ec.company_address, ''), COALESCE(c.description, ec.company_description, ''), ec.created_at
		FROM enrollment_codes ec
		LEFT JOIN schools s ON ec.school_id = s.id
		LEFT JOIN companies c ON ec.company_id = c.id
		ORDER BY ec.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ดึงข้อมูลรหัสเชิญล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var codes []models.EnrollmentCode
	for rows.Next() {
		var ec models.EnrollmentCode
		var expiresAt sql.NullTime
		var maxUses sql.NullInt64
		var schoolID sql.NullInt64
		var companyID sql.NullInt64

		err := rows.Scan(
			&ec.ID, &schoolID, &ec.SchoolName, &ec.Role, &ec.Code, &maxUses, &ec.UsedCount, &expiresAt, &ec.IsActive,
			&companyID, &ec.CompanyName, &ec.CompanyAddress, &ec.CompanyDescription, &ec.CreatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "การอ่านข้อมูลรหัสเชิญผิดพลาด: " + err.Error()})
			return
		}

		if schoolID.Valid {
			idVal := int(schoolID.Int64)
			ec.SchoolID = &idVal
		}
		if companyID.Valid {
			idVal := int(companyID.Int64)
			ec.CompanyID = &idVal
		}
		if maxUses.Valid {
			maxVal := int(maxUses.Int64)
			ec.MaxUses = &maxVal
		}
		if expiresAt.Valid {
			ec.ExpiresAt = &expiresAt.Time
		}

		codes = append(codes, ec)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ดึงข้อมูลรหัสเชิญสำเร็จ",
		"data":    codes,
	})
}

// CreateCodeHandler creates a new enrollment or invite code
func CreateCodeHandler(c *gin.Context) {
	var input models.CreateCodeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	code := strings.TrimSpace(strings.ToUpper(input.Code))
	if len(code) < 3 {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "รหัสเชิญต้องมีความยาวอย่างน้อย 3 ตัวอักษร"})
		return
	}

	// Double-check unique code
	var exists bool
	config.DB.QueryRow("SELECT COUNT(*) FROM enrollment_codes WHERE code = ?", code).Scan(&exists)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"status": 409, "error": "รหัสเชิญนี้มีผู้ใช้งานไปแล้ว กรุณาระบุรหัสอื่น"})
		return
	}

	// Verify school if role is not company
	if input.Role != "company" && input.SchoolID != nil {
		var schoolExists bool
		config.DB.QueryRow("SELECT COUNT(*) FROM schools WHERE id = ?", *input.SchoolID).Scan(&schoolExists)
		if !schoolExists {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ไม่พบสถานศึกษาที่ระบุ"})
			return
		}
	} else if input.Role != "company" && input.SchoolID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "กรุณาระบุสถานศึกษาสำหรับบทบาทนักศึกษาหรืออาจารย์"})
		return
	}

	companyName := strings.TrimSpace(input.CompanyName)
	companyAddress := strings.TrimSpace(input.CompanyAddress)
	companyDescription := strings.TrimSpace(input.CompanyDescription)

	if input.Role == "company" && companyName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "กรุณาระบุชื่อสถานประกอบการสำหรับรหัสเชิญบริษัท"})
		return
	}

	// For company, schoolID should be NULL
	var schoolIDVal interface{}
	if input.Role != "company" && input.SchoolID != nil {
		schoolIDVal = *input.SchoolID
	} else {
		schoolIDVal = nil
	}

	result, err := config.DB.Exec(`
		INSERT INTO enrollment_codes (school_id, role, code, max_uses, expires_at, company_name, company_address, company_description) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		schoolIDVal, input.Role, code, input.MaxUses, input.ExpiresAt,
		nullIfEmpty(companyName), nullIfEmpty(companyAddress), nullIfEmpty(companyDescription),
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "สร้างรหัสเชิญล้มเหลว: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{
		"status":  201,
		"message": "สร้างรหัสเชิญสำเร็จ",
		"data": gin.H{
			"id":                  id,
			"code":                code,
			"role":                input.Role,
			"school_id":           input.SchoolID,
			"max_uses":            input.MaxUses,
			"expires_at":          input.ExpiresAt,
			"is_active":           true,
			"company_name":        companyName,
			"company_address":     companyAddress,
			"company_description": companyDescription,
		},
	})
}

// UpdateCodeHandler updates code status, max uses, or expiry date
func UpdateCodeHandler(c *gin.Context) {
	codeID := c.Param("id")
	var input models.UpdateCodeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	newCode := strings.TrimSpace(strings.ToUpper(input.Code))

	// Verify unique if code is changing
	var currentCode string
	err := config.DB.QueryRow("SELECT code FROM enrollment_codes WHERE id = ?", codeID).Scan(&currentCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": 404, "error": "ไม่พบรหัสเชิญที่ต้องการแก้ไข"})
		return
	}

	if newCode != currentCode {
		var exists bool
		config.DB.QueryRow("SELECT COUNT(*) FROM enrollment_codes WHERE code = ? AND id <> ?", newCode, codeID).Scan(&exists)
		if exists {
			c.JSON(http.StatusConflict, gin.H{"status": 409, "error": "รหัสเชิญนี้มีในระบบแล้ว กรุณาเลือกรหัสอื่น"})
			return
		}
	}

	// Build update query
	query := "UPDATE enrollment_codes SET code = ?, max_uses = ?, expires_at = ?"
	args := []interface{}{newCode, input.MaxUses, input.ExpiresAt}

	if input.IsActive != nil {
		query += ", is_active = ?"
		args = append(args, *input.IsActive)
	}

	query += " WHERE id = ?"
	args = append(args, codeID)

	_, err = config.DB.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ปรับปรุงข้อมูลรหัสเชิญล้มเหลว: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ปรับปรุงข้อมูลรหัสเชิญสำเร็จ",
	})
}

// DeleteCodeHandler deletes an enrollment code from the database
func DeleteCodeHandler(c *gin.Context) {
	codeID := c.Param("id")
	_, err := config.DB.Exec("DELETE FROM enrollment_codes WHERE id = ?", codeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ลบรหัสเชิญล้มเหลว: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ลบรหัสเชิญสำเร็จ",
	})
}

// GetTablesHandler returns list of all tables in the current database
func GetTablesHandler(c *gin.Context) {
	rows, err := config.DB.Query("SHOW TABLES")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ดึงข้อมูลตารางล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "การดึงข้อมูลผิดพลาด: " + err.Error()})
			return
		}
		tables = append(tables, table)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ดึงข้อมูลตารางสำเร็จ",
		"data":    tables,
	})
}

// ExecuteQueryHandler runs arbitrary SQL query (Admin only)
func ExecuteQueryHandler(c *gin.Context) {
	var input struct {
		Query string `json:"query" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	query := strings.TrimSpace(input.Query)
	upperQuery := strings.ToUpper(query)
	isSelect := strings.HasPrefix(upperQuery, "SELECT") || strings.HasPrefix(upperQuery, "SHOW") || strings.HasPrefix(upperQuery, "DESCRIBE") || strings.HasPrefix(upperQuery, "EXPLAIN")

	if isSelect {
		rows, err := config.DB.Query(query)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "Query execution failed: " + err.Error()})
			return
		}
		defer rows.Close()

		columns, err := rows.Columns()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "Columns retrieval failed: " + err.Error()})
			return
		}

		var result []map[string]interface{}
		for rows.Next() {
			values := make([]interface{}, len(columns))
			valuePtrs := make([]interface{}, len(columns))
			for i := range columns {
				valuePtrs[i] = &values[i]
			}

			if err := rows.Scan(valuePtrs...); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "Scan failed: " + err.Error()})
				return
			}

			rowMap := make(map[string]interface{})
			for i, col := range columns {
				val := values[i]
				b, ok := val.([]byte)
				if ok {
					rowMap[col] = string(b)
				} else {
					rowMap[col] = val
				}
			}
			result = append(result, rowMap)
		}

		if result == nil {
			result = []map[string]interface{}{}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  200,
			"message": "Query executed successfully",
			"type":    "select",
			"columns": columns,
			"data":    result,
		})
	} else {
		res, err := config.DB.Exec(query)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "Exec failed: " + err.Error()})
			return
		}

		rowsAffected, _ := res.RowsAffected()
		lastInsertID, _ := res.LastInsertId()

		c.JSON(http.StatusOK, gin.H{
			"status":        200,
			"message":       "Query executed successfully",
			"type":          "exec",
			"rows_affected": rowsAffected,
			"last_insert_id": lastInsertID,
		})
	}
}

func nullIfEmpty(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return strings.TrimSpace(value)
}

// ========================================================
// 👔 COMPANY EMPLOYEE CODE MANAGEMENT HANDLERS
// ========================================================

// CreateEmployeeCodeHandler allows a company admin to create an invite code for employees.
// The code is automatically linked to the admin's company.
func CreateEmployeeCodeHandler(c *gin.Context) {
	// Get the company admin's user ID from JWT claims
	userIDRaw, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"status": 401, "error": "ไม่พบข้อมูลผู้ใช้"})
		return
	}
	userID := int(userIDRaw.(float64))

	// Verify the user is a company admin
	var companyRole sql.NullString
	var companyID sql.NullInt64
	err := config.DB.QueryRow(
		"SELECT company_role, company_id FROM users WHERE id = ? AND role = 'company'",
		userID,
	).Scan(&companyRole, &companyID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "เฉพาะผู้ใช้ที่มีบทบาท company เท่านั้น"})
		return
	}
	if !companyRole.Valid || companyRole.String != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "เฉพาะ Company Admin เท่านั้นที่สามารถสร้างรหัสเชิญพนักงานได้"})
		return
	}
	if !companyID.Valid {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ไม่พบข้อมูลบริษัท กรุณาติดต่อผู้ดูแลระบบ"})
		return
	}

	var input struct {
		Code string `json:"code" binding:"required,min=3"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "กรุณาระบุรหัสเชิญที่ถูกต้อง"})
		return
	}

	code := strings.TrimSpace(strings.ToUpper(input.Code))

	// Check uniqueness
	var exists2 bool
	config.DB.QueryRow("SELECT COUNT(*) FROM enrollment_codes WHERE code = ?", code).Scan(&exists2)
	if exists2 {
		c.JSON(http.StatusConflict, gin.H{"status": 409, "error": "รหัสเชิญนี้มีในระบบแล้ว กรุณาเลือกรหัสอื่น"})
		return
	}

	// Get company name for the response
	var companyName string
	config.DB.QueryRow("SELECT company_name FROM companies WHERE id = ?", companyID.Int64).Scan(&companyName)

	result, err := config.DB.Exec(`
		INSERT INTO enrollment_codes (role, code, company_id, company_name, is_active)
		VALUES ('company', ?, ?, ?, 1)`,
		code, companyID.Int64, companyName,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "สร้างรหัสเชิญล้มเหลว: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{
		"status":  201,
		"message": "สร้างรหัสเชิญพนักงานสำเร็จ",
		"data": gin.H{
			"id":           id,
			"code":         code,
			"role":         "company",
			"company_id":   companyID.Int64,
			"company_name": companyName,
			"is_active":    true,
		},
	})
}

// GetCompanyCodesHandler returns all active invite codes for the company admin's company.
func GetCompanyCodesHandler(c *gin.Context) {
	userIDRaw, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"status": 401, "error": "ไม่พบข้อมูลผู้ใช้"})
		return
	}
	userID := int(userIDRaw.(float64))

	var companyID sql.NullInt64
	err := config.DB.QueryRow("SELECT company_id FROM users WHERE id = ? AND role = 'company' AND company_role = 'admin'", userID).Scan(&companyID)
	if err != nil || !companyID.Valid {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "เฉพาะ Company Admin เท่านั้น"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT ec.id, ec.role, ec.code, ec.used_count, ec.expires_at, ec.is_active,
		       ec.company_id, COALESCE(c.company_name, ec.company_name, '') as company_name, ec.created_at
		FROM enrollment_codes ec
		LEFT JOIN companies c ON ec.company_id = c.id
		WHERE ec.company_id = ? AND ec.role = 'company' AND ec.is_active = 1
		ORDER BY ec.created_at DESC
	`, companyID.Int64)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ดึงข้อมูลรหัสเชิญล้มเหลว"})
		return
	}
	defer rows.Close()

	type CodeRow struct {
		ID          int64       `json:"id"`
		Role        string      `json:"role"`
		Code        string      `json:"code"`
		UsedCount   int         `json:"used_count"`
		ExpiresAt   interface{} `json:"expires_at"`
		IsActive    bool        `json:"is_active"`
		CompanyID   int64       `json:"company_id"`
		CompanyName string      `json:"company_name"`
		CreatedAt   string      `json:"created_at"`
	}

	var codes []CodeRow
	for rows.Next() {
		var row CodeRow
		var expiresAt sql.NullTime
		var createdAt sql.NullTime
		if err := rows.Scan(&row.ID, &row.Role, &row.Code, &row.UsedCount, &expiresAt, &row.IsActive,
			&row.CompanyID, &row.CompanyName, &createdAt); err != nil {
			continue
		}
		if expiresAt.Valid {
			row.ExpiresAt = expiresAt.Time
		}
		if createdAt.Valid {
			row.CreatedAt = createdAt.Time.Format(time.RFC3339)
		}
		codes = append(codes, row)
	}

	if codes == nil {
		codes = []CodeRow{}
	}

	c.JSON(http.StatusOK, gin.H{"status": 200, "message": "ดึงข้อมูลรหัสเชิญสำเร็จ", "data": codes})
}
