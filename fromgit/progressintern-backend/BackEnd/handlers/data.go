package handlers

import (
	"database/sql"
	"internship-backend/config"
	"time"

	"github.com/gin-gonic/gin"
)

func HealthHandler(c *gin.Context) {
	if err := config.DB.Ping(); err != nil {
		c.JSON(503, gin.H{"status": "error", "database": "down"})
		return
	}
	c.JSON(200, gin.H{"status": "ok", "database": "up"})
}

func GetUsersHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, name, email, role, phone, profile_image, created_at, updated_at FROM users ORDER BY id",
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to load users"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id int
		var name, email, role string
		var phone, profileImage sql.NullString
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &name, &email, &role, &phone, &profileImage, &createdAt, &updatedAt); err != nil {
			c.JSON(500, gin.H{"error": "failed to read users"})
			return
		}
		list = append(list, gin.H{
			"id":            id,
			"name":          name,
			"email":         email,
			"role":          role,
			"phone":         nullString(phone),
			"profile_image": nullString(profileImage),
			"created_at":    createdAt,
			"updated_at":    updatedAt,
		})
	}
	c.JSON(200, list)
}

func GetCompaniesHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, user_id, company_name, description, address, website, created_at, updated_at FROM companies ORDER BY id",
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to load companies"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, userID int
		var companyName string
		var description, address, website sql.NullString
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &userID, &companyName, &description, &address, &website, &createdAt, &updatedAt); err != nil {
			c.JSON(500, gin.H{"error": "failed to read companies"})
			return
		}
		list = append(list, gin.H{
			"id":           id,
			"user_id":      userID,
			"company_name": companyName,
			"description":  nullString(description),
			"address":      nullString(address),
			"website":      nullString(website),
			"created_at":   createdAt,
			"updated_at":   updatedAt,
		})
	}
	c.JSON(200, list)
}

func GetApplicationsHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, student_id, job_posting_id, status, created_at, updated_at FROM applications ORDER BY id",
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to load applications"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, studentID, jobPostingID int
		var status string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &studentID, &jobPostingID, &status, &createdAt, &updatedAt); err != nil {
			c.JSON(500, gin.H{"error": "failed to read applications"})
			return
		}
		list = append(list, gin.H{
			"id":             id,
			"student_id":     studentID,
			"job_posting_id": jobPostingID,
			"status":         status,
			"applied_at":     createdAt,
			"updated_at":     updatedAt,
		})
	}
	c.JSON(200, list)
}

func GetInternshipsHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, student_id, company_id, job_posting_id, start_date, end_date, status, created_at, updated_at FROM internships ORDER BY id",
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to load internships"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, studentID, companyID, jobPostingID int
		var startDate, endDate string
		var status string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &studentID, &companyID, &jobPostingID, &startDate, &endDate, &status, &createdAt, &updatedAt); err != nil {
			c.JSON(500, gin.H{"error": "failed to read internships"})
			return
		}
		list = append(list, gin.H{
			"id":             id,
			"student_id":     studentID,
			"company_id":     companyID,
			"job_posting_id": jobPostingID,
			"start_date":     startDate,
			"end_date":       endDate,
			"status":         status,
			"created_at":     createdAt,
			"updated_at":     updatedAt,
		})
	}
	c.JSON(200, list)
}

func CreateInternshipHandler(c *gin.Context) {
	var input struct {
		StudentID    int    `json:"student_id" binding:"required"`
		CompanyID    int    `json:"company_id" binding:"required"`
		JobPostingID int    `json:"job_posting_id" binding:"required"`
		StartDate    string `json:"start_date" binding:"required"`
		EndDate      string `json:"end_date" binding:"required"`
		Status       string `json:"status"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid internship data"})
		return
	}
	if input.Status == "" {
		input.Status = "active"
	}

	result, err := config.DB.Exec(
		"INSERT INTO internships (student_id, company_id, job_posting_id, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)",
		input.StudentID, input.CompanyID, input.JobPostingID, input.StartDate, input.EndDate, input.Status,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to create internship"})
		return
	}
	id, _ := result.LastInsertId()
	c.JSON(201, gin.H{
		"id":             id,
		"student_id":     input.StudentID,
		"company_id":     input.CompanyID,
		"job_posting_id": input.JobPostingID,
		"start_date":     input.StartDate,
		"end_date":       input.EndDate,
		"status":         input.Status,
	})
}

func GetEvaluationsHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, internship_id, evaluator_id, score, comment, evaluator_role, created_at, updated_at FROM evaluations ORDER BY id",
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to load evaluations"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, internshipID, evaluatorID int
		var score float64
		var feedback, evaluationType string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &internshipID, &evaluatorID, &score, &feedback, &evaluationType, &createdAt, &updatedAt); err != nil {
			c.JSON(500, gin.H{"error": "failed to read evaluations"})
			return
		}
		list = append(list, gin.H{
			"id":              id,
			"internship_id":   internshipID,
			"evaluator_id":    evaluatorID,
			"score":           score,
			"feedback":        feedback,
			"evaluation_type": evaluationType,
			"created_at":      createdAt,
			"updated_at":      updatedAt,
		})
	}
	c.JSON(200, list)
}

func CreateEvaluationHandler(c *gin.Context) {
	var input struct {
		InternshipID   int     `json:"internship_id" binding:"required"`
		EvaluatorID    int     `json:"evaluator_id" binding:"required"`
		Score          float64 `json:"score" binding:"required"`
		Feedback       string  `json:"feedback"`
		EvaluationType string  `json:"evaluation_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid evaluation data"})
		return
	}

	result, err := config.DB.Exec(
		"INSERT INTO evaluations (internship_id, evaluator_id, score, comment, evaluator_role) VALUES (?, ?, ?, ?, ?)",
		input.InternshipID, input.EvaluatorID, input.Score, input.Feedback, input.EvaluationType,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to create evaluation"})
		return
	}
	id, _ := result.LastInsertId()
	c.JSON(201, gin.H{
		"id":              id,
		"internship_id":   input.InternshipID,
		"evaluator_id":    input.EvaluatorID,
		"score":           input.Score,
		"feedback":        input.Feedback,
		"evaluation_type": input.EvaluationType,
	})
}

func nullString(value sql.NullString) any {
	if value.Valid {
		return value.String
	}
	return nil
}
