package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"internship-backend/config"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// GenerateRandomString generates a secure random string of given length
func GenerateRandomString(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// getUserCompanyID resolves a user's company ID from their user ID
func getUserCompanyID(userID int) (int, error) {
	var companyID sql.NullInt64
	err := config.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", userID).Scan(&companyID)
	if err == nil && companyID.Valid {
		return int(companyID.Int64), nil
	}

	// Fallback: check if they are the primary owner of any company
	var cID int
	err = config.DB.QueryRow("SELECT id FROM companies WHERE user_id = ?", userID).Scan(&cID)
	if err == nil {
		// Heal the users record to cache the company ID
		_, _ = config.DB.Exec("UPDATE users SET company_id = ? WHERE id = ?", cID, userID)
		return cID, nil
	}
	return 0, fmt.Errorf("company profile not found for user %d", userID)
}

// CreateCompanyHandler allows any user to add a new company
func CreateCompanyHandler(c *gin.Context) {
	var input struct {
		CompanyName string `json:"company_name" binding:"required,min=2,max=255"`
		Description string `json:"description"`
		Address     string `json:"address"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	companyName := strings.TrimSpace(input.CompanyName)
	description := strings.TrimSpace(input.Description)
	address := strings.TrimSpace(input.Address)

	// Check if company already exists
	var exists bool
	err := config.DB.QueryRow("SELECT COUNT(*) FROM companies WHERE company_name = ?", companyName).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ตรวจสอบข้อมูลล้มเหลว: " + err.Error()})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"status": 409, "error": "มีบริษัทนี้อยู่ในระบบแล้ว"})
		return
	}

	// Start transaction to create placeholder user + company profile
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ไม่สามารถเชื่อมต่อฐานข้อมูลได้: " + err.Error()})
		return
	}
	defer tx.Rollback()

	// Create a placeholder user
	placeholderEmail := fmt.Sprintf("company_placeholder_%s@company.com", GenerateRandomString(6))
	dummyPassword := GenerateRandomString(12)
	hashed, _ := bcrypt.GenerateFromPassword([]byte(dummyPassword), 10)

	res, err := tx.Exec(`
		INSERT INTO users (name, email, password, role, phone, intro, field, school, status) 
		VALUES (?, ?, ?, 'company', '', '', '', '-', 'active')`,
		companyName, placeholderEmail, string(hashed),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "สร้างบัญชีผู้ใช้สำหรับบริษัทล้มเหลว: " + err.Error()})
		return
	}

	userID, _ := res.LastInsertId()

	// Create company profile
	compRes, err := tx.Exec(`
		INSERT INTO companies (user_id, company_name, description, address, contact_email) 
		VALUES (?, ?, ?, ?, ?)`,
		userID, companyName, description, address, placeholderEmail,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "สร้างโปรไฟล์บริษัทล้มเหลว: " + err.Error()})
		return
	}

	companyID, _ := compRes.LastInsertId()

	// Set user's company_id directly
	_, err = tx.Exec("UPDATE users SET company_id = ? WHERE id = ?", companyID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "บันทึกสิทธิ์บริษัทล้มเหลว: " + err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "การบันทึกข้อมูลล้มเหลว: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  201,
		"message": "เพิ่มบริษัทสำเร็จ",
		"data": gin.H{
			"id":           companyID,
			"user_id":      userID,
			"company_name": companyName,
			"description":  description,
			"address":      address,
		},
	})
}
