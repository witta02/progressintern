package handlers

import (
	"database/sql"
	"time"

	"internship-backend/BackEnd/config"
	"internship-backend/BackEnd/models"

	"github.com/gin-gonic/gin"
)

func CreateJobHandler(c *gin.Context) {
	var input models.JobPostingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid job data"})
		return
	}

	result, err := config.DB.Exec(
		"INSERT INTO job_postings (company_id, title, description, requirements, benefits, slots) VALUES (?, ?, ?, ?, ?, ?)",
		input.CompanyID, input.Title, input.Description, input.Requirements, input.Benefits, input.Slots,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to create job"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(201, gin.H{
		"id":           id,
		"company_id":   input.CompanyID,
		"title":        input.Title,
		"description":  input.Description,
		"requirements": input.Requirements,
		"benefits":     input.Benefits,
		"slots":        input.Slots,
		"status":       "open",
	})
}

func GetAllJobsHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, company_id, title, description, requirements, benefits, slots, status, created_at, updated_at FROM job_postings WHERE status = 'open' ORDER BY id",
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to load jobs"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, companyID, slots int
		var title, status string
		var description, requirements, benefits sql.NullString
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &companyID, &title, &description, &requirements, &benefits, &slots, &status, &createdAt, &updatedAt); err != nil {
			c.JSON(500, gin.H{"error": "failed to read jobs"})
			return
		}
		list = append(list, gin.H{
			"id":           id,
			"company_id":   companyID,
			"title":        title,
			"description":  nullString(description),
			"requirements": nullString(requirements),
			"benefits":     nullString(benefits),
			"slots":        slots,
			"status":       status,
			"created_at":   createdAt,
			"updated_at":   updatedAt,
		})
	}

	c.JSON(200, list)
}
