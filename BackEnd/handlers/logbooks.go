package handlers

import (
	"database/sql"
	"time"

	"internship-backend/BackEnd/config"
	"internship-backend/BackEnd/models"

	"github.com/gin-gonic/gin"
)

func GetLogbooksHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, internship_id, title, content, mentor_comment, status, created_at, updated_at FROM logbooks ORDER BY id",
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to load logbooks"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, internshipID int
		var title, content, status string
		var mentorComment sql.NullString
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &internshipID, &title, &content, &mentorComment, &status, &createdAt, &updatedAt); err != nil {
			c.JSON(500, gin.H{"error": "failed to read logbooks"})
			return
		}
		list = append(list, logbookJSON(id, internshipID, title, content, mentorComment, status, createdAt, updatedAt))
	}

	c.JSON(200, list)
}

func CreateLogbookHandler(c *gin.Context) {
	var input models.LogbookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid logbook data"})
		return
	}

	result, err := config.DB.Exec(
		"INSERT INTO logbooks (internship_id, student_id, title, content, status) VALUES (?, ?, ?, ?, 'submitted')",
		input.InternshipID, input.StudentID, input.Title, input.Content,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to create logbook"})
		return
	}

	id, _ := result.LastInsertId()
	now := time.Now()
	c.JSON(201, gin.H{
		"id":             id,
		"internship_id":  input.InternshipID,
		"title":          input.Title,
		"content":        input.Content,
		"attachment_url": nil,
		"mentor_comment": nil,
		"status":         "pending",
		"created_at":     now,
		"updated_at":     now,
	})
}

func ApproveLogbookHandler(c *gin.Context) {
	logID := c.Param("id")
	var input struct {
		Comment       string `json:"comment"`
		MentorComment string `json:"mentor_comment"`
		Status        string `json:"status" binding:"required,oneof=approved rejected"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid logbook status"})
		return
	}

	comment := input.MentorComment
	if comment == "" {
		comment = input.Comment
	}

	_, err := config.DB.Exec(
		"UPDATE logbooks SET mentor_comment = ?, status = ?, reviewed_at = NOW() WHERE id = ?",
		comment, input.Status, logID,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to update logbook"})
		return
	}

	c.JSON(200, gin.H{
		"id":             logID,
		"mentor_comment": comment,
		"status":         input.Status,
		"updated_at":     time.Now(),
	})
}

func logbookJSON(id, internshipID int, title, content string, mentorComment sql.NullString, status string, createdAt, updatedAt time.Time) gin.H {
	return gin.H{
		"id":             id,
		"internship_id":  internshipID,
		"title":          title,
		"content":        content,
		"attachment_url": nil,
		"mentor_comment": nullString(mentorComment),
		"status":         normalizeLogbookStatus(status),
		"created_at":     createdAt,
		"updated_at":     updatedAt,
	}
}

func normalizeLogbookStatus(status string) string {
	if status == "submitted" || status == "draft" {
		return "pending"
	}
	return status
}
