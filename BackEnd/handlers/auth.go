package handlers

import (
	"database/sql"
	"os"
	"time"

	"internship-backend/BackEnd/config"
	"internship-backend/BackEnd/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func jwtSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "change-me-in-production"
	}
	return []byte(secret)
}

func RegisterHandler(c *gin.Context) {
	var input models.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid registration data"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(input.Password), 10)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to secure password"})
		return
	}

	result, err := config.DB.Exec(
		"INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)",
		input.Name, input.Email, string(hashed), input.Role, input.Phone,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "email may already exist or user could not be created"})
		return
	}

	userID, _ := result.LastInsertId()
	if input.Role == "company" && input.CompanyName != "" {
		_, _ = config.DB.Exec(
			"INSERT INTO companies (user_id, company_name, description, address) VALUES (?, ?, ?, ?)",
			userID, input.CompanyName, input.Description, input.Address,
		)
	}

	c.JSON(201, gin.H{
		"id":    userID,
		"name":  input.Name,
		"email": input.Email,
		"role":  input.Role,
		"phone": input.Phone,
	})
}

func LoginHandler(c *gin.Context) {
	var input models.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "email and password are required"})
		return
	}

	var id int
	var name, email, hashed, role string
	var phone sql.NullString
	err := config.DB.QueryRow(
		"SELECT id, name, email, password, role, phone FROM users WHERE email = ?",
		input.Email,
	).Scan(&id, &name, &email, &hashed, &role, &phone)
	if err != nil {
		c.JSON(401, gin.H{"error": "user not found"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hashed), []byte(input.Password)) != nil {
		c.JSON(401, gin.H{"error": "incorrect password"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": id,
		"role":    role,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenString, err := token.SignedString(jwtSecret())
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to create token"})
		return
	}

	c.JSON(200, gin.H{
		"id":    id,
		"name":  name,
		"email": email,
		"role":  role,
		"phone": nullString(phone),
		"token": tokenString,
	})
}
