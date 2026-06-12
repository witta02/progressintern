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
		SELECT ec.id, ec.school_id, COALESCE(s.name, '-') as school_name, ec.role, ec.code, ec.max_uses, ec.used_count, ec.expires_at, ec.is_active, ec.created_at
		FROM enrollment_codes ec
		LEFT JOIN schools s ON ec.school_id = s.id
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

		err := rows.Scan(
			&ec.ID, &schoolID, &ec.SchoolName, &ec.Role, &ec.Code, &maxUses, &ec.UsedCount, &expiresAt, &ec.IsActive, &ec.CreatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "การอ่านข้อมูลรหัสเชิญผิดพลาด: " + err.Error()})
			return
		}

		if schoolID.Valid {
			idVal := int(schoolID.Int64)
			ec.SchoolID = &idVal
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

	// For company, schoolID should be NULL
	var schoolIDVal interface{}
	if input.Role != "company" && input.SchoolID != nil {
		schoolIDVal = *input.SchoolID
	} else {
		schoolIDVal = nil
	}

	result, err := config.DB.Exec(`
		INSERT INTO enrollment_codes (school_id, role, code, max_uses, expires_at) 
		VALUES (?, ?, ?, ?, ?)`,
		schoolIDVal, input.Role, code, input.MaxUses, input.ExpiresAt,
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
			"id":         id,
			"code":       code,
			"role":       input.Role,
			"school_id":  input.SchoolID,
			"max_uses":   input.MaxUses,
			"expires_at": input.ExpiresAt,
			"is_active":  true,
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
