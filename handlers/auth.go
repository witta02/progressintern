package handlers

import (
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
	
	// Prevent registration as admin
	if input.Role == "admin" {
		c.JSON(400, gin.H{"status": 400, "error": "ไม่สามารถสมัครสมาชิกเป็นผู้ดูแลระบบได้"})
		return
	}

	status := "pending"
	if input.Role == "student" {
		if input.School != "" {
			var advisorCount int
			err := config.DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'advisor' AND school = ?", input.School).Scan(&advisorCount)
			if err == nil && advisorCount > 0 {
				status = "active"
			}
		}
	}


	// Ensure school is never empty for users table if it's NOT NULL
	schoolValue := input.School
	if schoolValue == "" {
		schoolValue = "-" // Default value for non-student/advisor roles
	}

	result, err := config.DB.Exec(
		"INSERT INTO users (name, email, password, role, phone, school, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
		input.Name, input.Email, string(hashed), input.Role, input.Phone, schoolValue, status,
	)
	if err != nil {
		fmt.Printf("❌ Register DB error: %v\n", err)
		// Check for duplicate entry error (standard MySQL error code 1062)
		if strings.Contains(err.Error(), "1062") || strings.Contains(err.Error(), "Duplicate entry") {
			c.JSON(409, gin.H{"status": 409, "error": "อีเมลนี้ถูกใช้งานไปแล้ว"})
		} else {
			c.JSON(500, gin.H{"status": 500, "error": "ไม่สามารถบันทึกข้อมูลได้: " + err.Error()})
		}
		return
	}

	userID, _ := result.LastInsertId()
	writeAuditLog(int(userID), "REGISTER", c.ClientIP())

	// Auto-create company profile when role=company
	if input.Role == "company" {
		companyName := input.CompanyName
		if companyName == "" {
			companyName = input.Name
		}
		contactEmail := input.ContactEmail
		if contactEmail == "" {
			contactEmail = input.Email
		}
		
		_, compErr := config.DB.Exec(
			"INSERT INTO companies (user_id, company_name, description, address, contact_email) VALUES (?, ?, ?, ?, ?)",
			userID, companyName, input.Description, input.Address, contactEmail,
		)
		if compErr != nil {
			fmt.Printf("⚠️ Could not create company profile: %v\n", compErr)
		}
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
	err := config.DB.QueryRow(
		"SELECT id, name, email, password, role, status FROM users WHERE email = ?",
		input.Email,
	).Scan(&id, &name, &email, &hashed, &role, &status)

	if err != nil {
		writeAuditLog(0, "LOGIN_FAILED_USER_NOT_FOUND", c.ClientIP())
		c.JSON(401, gin.H{"status": 401, "error": "ไม่พบผู้ใช้งานนี้"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hashed), []byte(input.Password)) != nil {
		writeAuditLog(id, "LOGIN_FAILED_WRONG_PASSWORD", c.ClientIP())
		c.JSON(401, gin.H{"status": 401, "error": "รหัสผ่านไม่ถูกต้อง"})
		return
	}

	writeAuditLog(id, "LOGIN_SUCCESS", c.ClientIP())

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

	// Return wrapped response matching frontend expectations
	c.JSON(200, gin.H{
		"status":  200,
		"message": "Login successful",
		"data": gin.H{
			"id":     id,
			"name":   name,
			"email":  email,
			"role":   role,
			"status": status,
			"token":  tString,
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

// writeAuditLog logs events to the audit_logs table
func writeAuditLog(userID int, action string, ipAddress string) {
	var dbUserID interface{}
	if userID > 0 {
		dbUserID = userID
	} else {
		dbUserID = nil
	}
	_, err := config.DB.Exec(
		"INSERT INTO audit_logs (user_id, action, ip_address) VALUES (?, ?, ?)",
		dbUserID, action, ipAddress,
	)
	if err != nil {
		fmt.Printf("⚠️ Audit log insert failed: %v\n", err)
	}
}
