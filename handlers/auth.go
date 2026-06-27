package handlers

import (
	"database/sql"
	"fmt"
	"internship-backend/config"
	"internship-backend/models"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Use the SAME key as middleware — read from env
func getJWTKey() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "internship_secret_key_2026_super_secret_key"
	}
	return []byte(secret)
}

// ========================================================
// [GET] ตรวจสอบรหัสลงทะเบียน/รหัสเชิญ
// ========================================================
func ValidateCodeHandler(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(400, gin.H{"status": 400, "error": "กรุณาระบุรหัสสมัครเรียนหรือรหัสเชิญ"})
		return
	}

	var role string
	var schoolID sql.NullInt64
	var schoolName sql.NullString
	var maxUses sql.NullInt64
	var usedCount int
	var expiresAt *time.Time
	var isActive bool
	var codeCompanyID sql.NullInt64
	var presetCompanyName sql.NullString
	var presetCompanyAddress sql.NullString
	var presetCompanyDescription sql.NullString
	var linkedCompanyName sql.NullString
	var linkedCompanyAddress sql.NullString
	var linkedCompanyDescription sql.NullString

	err := config.DB.QueryRow(`
		SELECT ec.role, ec.school_id, s.name, ec.max_uses, ec.used_count, ec.expires_at, ec.is_active,
		       ec.company_id, ec.company_name, ec.company_address, ec.company_description,
		       c.company_name, c.address, c.description
		FROM enrollment_codes ec
		LEFT JOIN schools s ON ec.school_id = s.id
		LEFT JOIN companies c ON ec.company_id = c.id
		WHERE ec.code = ?
	`, code).Scan(
		&role, &schoolID, &schoolName, &maxUses, &usedCount, &expiresAt, &isActive,
		&codeCompanyID, &presetCompanyName, &presetCompanyAddress, &presetCompanyDescription,
		&linkedCompanyName, &linkedCompanyAddress, &linkedCompanyDescription,
	)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"status": 404, "error": "รหัสสมัครเรียนหรือรหัสเชิญไม่ถูกต้อง"})
		return
	} else if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ข้อผิดพลาดระบบ: " + err.Error()})
		return
	}

	if !isActive {
		c.JSON(400, gin.H{"status": 400, "error": "รหัสนี้ถูกระงับการใช้งานแล้ว"})
		return
	}

	if expiresAt != nil && expiresAt.Before(time.Now()) {
		c.JSON(400, gin.H{"status": 400, "error": "รหัสนี้หมดอายุการใช้งานแล้ว"})
		return
	}

	if maxUses.Valid && int64(usedCount) >= maxUses.Int64 {
		c.JSON(400, gin.H{"status": 400, "error": "รหัสนี้มีการใช้ครบกำหนดแล้ว"})
		return
	}

	resp := models.ValidateCodeResponse{
		Code: code,
		Role: role,
	}
	if schoolID.Valid {
		resp.SchoolID = int(schoolID.Int64)
	}
	if schoolName.Valid {
		resp.SchoolName = schoolName.String
	}

	resolvedCompanyName := firstNonEmpty(linkedCompanyName, presetCompanyName)
	resolvedCompanyAddress := firstNonEmpty(linkedCompanyAddress, presetCompanyAddress)
	resolvedCompanyDescription := firstNonEmpty(linkedCompanyDescription, presetCompanyDescription)

	if resolvedCompanyName != "" {
		resp.CompanyName = resolvedCompanyName
	}
	if resolvedCompanyAddress != "" {
		resp.CompanyAddress = resolvedCompanyAddress
	}
	if resolvedCompanyDescription != "" {
		resp.CompanyDescription = resolvedCompanyDescription
	}
	if role == "company" && (codeCompanyID.Valid || resolvedCompanyName != "") {
		resp.SkipCompanyFields = true
	}

	c.JSON(200, gin.H{
		"status":  200,
		"message": "รหัสถูกต้อง",
		"data":    resp,
	})
}

// ========================================================
// [POST] สมัครสมาชิก
// ========================================================
func RegisterHandler(c *gin.Context) {
	var input models.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ครบถ้วน: " + err.Error()})
		return
	}

	// Password complexity check
	if err := validatePassword(input.Password); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "รหัสผ่านไม่ปลอดภัย: " + err.Error()})
		return
	}

	hashed, _ := bcrypt.GenerateFromPassword([]byte(input.Password), 10)

	// Validate Enrollment Code using transaction
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ไม่สามารถทำรายการได้: " + err.Error()})
		return
	}
	defer tx.Rollback()

	var codeID int
	var role string
	var schoolID sql.NullInt64
	var schoolName sql.NullString
	var maxUses sql.NullInt64
	var usedCount int
	var expiresAt *time.Time
	var isActive bool
	var codeCompanyID sql.NullInt64
	var presetCompanyName sql.NullString
	var presetCompanyAddress sql.NullString
	var presetCompanyDescription sql.NullString

	err = tx.QueryRow(`
		SELECT ec.id, ec.role, ec.school_id, s.name, ec.max_uses, ec.used_count, ec.expires_at, ec.is_active, ec.company_id,
		       ec.company_name, ec.company_address, ec.company_description
		FROM enrollment_codes ec
		LEFT JOIN schools s ON ec.school_id = s.id
		WHERE ec.code = ? FOR UPDATE
	`, input.Code).Scan(
		&codeID, &role, &schoolID, &schoolName, &maxUses, &usedCount, &expiresAt, &isActive, &codeCompanyID,
		&presetCompanyName, &presetCompanyAddress, &presetCompanyDescription,
	)

	if err == sql.ErrNoRows {
		c.JSON(400, gin.H{"status": 400, "error": "รหัสสมัครเรียนหรือรหัสเชิญไม่ถูกต้อง"})
		return
	} else if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ข้อผิดพลาดฐานข้อมูล: " + err.Error()})
		return
	}

	if !isActive {
		c.JSON(400, gin.H{"status": 400, "error": "รหัสนี้ถูกระงับการใช้งานแล้ว"})
		return
	}

	if expiresAt != nil && expiresAt.Before(time.Now()) {
		c.JSON(400, gin.H{"status": 400, "error": "รหัสนี้หมดอายุการใช้งานแล้ว"})
		return
	}

	if maxUses.Valid && int64(usedCount) >= maxUses.Int64 {
		c.JSON(400, gin.H{"status": 400, "error": "รหัสนี้มีการใช้ครบกำหนดแล้ว"})
		return
	}

	resolvedRole := role
	var resolvedSchoolID interface{}
	var resolvedSchoolName string

	if schoolID.Valid {
		resolvedSchoolID = schoolID.Int64
	} else {
		resolvedSchoolID = nil
	}

	if schoolName.Valid {
		resolvedSchoolName = schoolName.String
	} else {
		resolvedSchoolName = "-" // Default for non-school users
	}

	if resolvedRole == "admin" {
		c.JSON(400, gin.H{"status": 400, "error": "ไม่สามารถสมัครสมาชิกเป็นผู้ดูแลระบบได้"})
		return
	}

	status := "active"
	if resolvedRole == "advisor" {
		status = "pending"
	}

	result, err := tx.Exec(`
		INSERT INTO users (name, email, password, role, phone, intro, field, school, school_id, status) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Name, input.Email, string(hashed), resolvedRole, input.Phone, input.Intro, input.Field, resolvedSchoolName, resolvedSchoolID, status,
	)
	if err != nil {
		fmt.Printf("❌ Register DB error: %v\n", err)
		if strings.Contains(err.Error(), "1062") || strings.Contains(err.Error(), "Duplicate entry") {
			c.JSON(409, gin.H{"status": 409, "error": "อีเมลนี้ถูกใช้งานไปแล้ว"})
		} else {
			c.JSON(500, gin.H{"status": 500, "error": "ไม่สามารถบันทึกข้อมูลได้: " + err.Error()})
		}
		return
	}

	userID, _ := result.LastInsertId()

	if resolvedRole == "company" {
		if codeCompanyID.Valid {
			// Subsequent user — link to existing company as employee
			companyID := codeCompanyID.Int64
			_, compErr := tx.Exec("UPDATE users SET company_id = ?, company_role = 'employee' WHERE id = ?", companyID, userID)
			if compErr != nil {
				fmt.Printf("⚠️ Could not associate user with existing company: %v\n", compErr)
			}
		} else {
			// First user for this company — becomes company admin
			companyName := strings.TrimSpace(input.CompanyName)
			if companyName == "" && presetCompanyName.Valid {
				companyName = strings.TrimSpace(presetCompanyName.String)
			}
			if companyName == "" {
				companyName = input.Name
			}

			description := strings.TrimSpace(input.Description)
			if description == "" && presetCompanyDescription.Valid {
				description = strings.TrimSpace(presetCompanyDescription.String)
			}

			address := strings.TrimSpace(input.Address)
			if address == "" && presetCompanyAddress.Valid {
				address = strings.TrimSpace(presetCompanyAddress.String)
			}

			contactEmail := input.ContactEmail
			if contactEmail == "" {
				contactEmail = input.Email
			}

			compRes, compErr := tx.Exec(
				"INSERT INTO companies (user_id, company_name, description, address, contact_email) VALUES (?, ?, ?, ?, ?)",
				userID, companyName, description, address, contactEmail,
			)
			if compErr != nil {
				fmt.Printf("⚠️ Could not create company profile: %v\n", compErr)
			} else {
				companyID, _ := compRes.LastInsertId()

				// Associate this code with the company so future registers share it
				_, _ = tx.Exec("UPDATE enrollment_codes SET company_id = ? WHERE id = ?", companyID, codeID)

				// Link user to company as admin
				_, _ = tx.Exec("UPDATE users SET company_id = ?, company_role = 'admin' WHERE id = ?", companyID, userID)
			}
		}
	}

	_, err = tx.Exec("UPDATE enrollment_codes SET used_count = used_count + 1 WHERE id = ?", codeID)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ไม่สามารถอัปเดตข้อมูลรหัสเชิญได้: " + err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "บันทึกรายการไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(201, gin.H{"status": 201, "message": "สมัครสมาชิกสำเร็จ"})
}

// ========================================================
// [POST] เข้าสู่ระบบ
// ========================================================
func LoginHandler(c *gin.Context) {
	var input models.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "กรุณากรอกอีเมลและรหัสผ่าน"})
		return
	}

	var id int
	var name, email, hashed, role, status string
	var companyID sql.NullInt64
	var companyRole sql.NullString
	err := config.DB.QueryRow(
		"SELECT id, name, email, password, role, status, company_id, company_role FROM users WHERE email = ?",
		input.Email,
	).Scan(&id, &name, &email, &hashed, &role, &status, &companyID, &companyRole)

	if err != nil {
		c.JSON(401, gin.H{"status": 401, "error": "ไม่พบผู้ใช้งานนี้"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hashed), []byte(input.Password)) != nil {
		c.JSON(401, gin.H{"status": 401, "error": "รหัสผ่านไม่ถูกต้อง"})
		return
	}

	// สร้าง JWT Token — use getJWTKey() to match middleware
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": id,
		"role":    role,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
	})

	tString, err := token.SignedString(getJWTKey())
	if err != nil {
		fmt.Printf("❌ JWT signing error: %v\n", err)
		c.JSON(500, gin.H{"status": 500, "error": "สร้าง Token ไม่สำเร็จ"})
		return
	}

	var cIDVal interface{} = nil
	if companyID.Valid {
		cIDVal = companyID.Int64
	}

	var cRoleVal interface{} = nil
	if companyRole.Valid {
		cRoleVal = companyRole.String
	}

	// Return wrapped response matching frontend expectations
	c.JSON(200, gin.H{
		"status":  200,
		"message": "Login successful",
		"data": gin.H{
			"id":           id,
			"name":         name,
			"email":        email,
			"role":         role,
			"status":       status,
			"company_id":   cIDVal,
			"company_role": cRoleVal,
			"token":        tString,
		},
	})
}

// validatePassword checks complexity criteria
func validatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("ต้องมีความยาวอย่างน้อย 8 ตัวอักษร")
	}
	if !regexp.MustCompile(`[A-Z]`).MatchString(password) {
		return fmt.Errorf("ต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว")
	}
	if !regexp.MustCompile(`[a-z]`).MatchString(password) {
		return fmt.Errorf("ต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว")
	}
	if !regexp.MustCompile(`[0-9]`).MatchString(password) {
		return fmt.Errorf("ต้องมีตัวเลขอย่างน้อย 1 ตัว")
	}
	if !regexp.MustCompile(`[!@#\$%\^&\*\(\)_\+\-=\[\]\{\};':",\./<>\?~` + "`" + `|]`).MatchString(password) {
		return fmt.Errorf("ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว")
	}
	return nil
}

func firstNonEmpty(values ...sql.NullString) string {
	for _, value := range values {
		if value.Valid && strings.TrimSpace(value.String) != "" {
			return strings.TrimSpace(value.String)
		}
	}
	return ""
}
