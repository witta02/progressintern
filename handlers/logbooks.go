package handlers

import (
	"internship-backend/config"

	"github.com/gin-gonic/gin"
)

// ========================================================
// [POST] นักศึกษาส่งรายงานประจำวัน (Logbook)
// ========================================================
func CreateLogbookHandler(c *gin.Context) {
	var input struct {
		InternshipID  int    `json:"internship_id" binding:"required"`
		Title         string `json:"title" binding:"required"`
		Content       string `json:"content" binding:"required"`
		AttachmentURL string `json:"attachment_url"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "กรอกข้อมูลไม่ครบถ้วน: " + err.Error()})
		return
	}

	_, err := config.DB.Exec(
		"INSERT INTO logbooks (internship_id, title, content, attachment_url) VALUES (?, ?, ?, ?)",
		input.InternshipID, input.Title, input.Content, input.AttachmentURL,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ส่งรายงานบันทึกไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(201, gin.H{"status": 201, "message": "บันทึกรายงานการฝึกงานส่งเรียบร้อย"})
}

// ========================================================
// [PUT] พี่เลี้ยงตรวจและอนุมัติ Logbook
// ========================================================
func ApproveLogbookHandler(c *gin.Context) {
	logID := c.Param("id")

	var input struct {
		Comment string `json:"comment"`
		Status  string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "กรุณาระบุสถานะผลตรวจ"})
		return
	}

	_, err := config.DB.Exec(
		"UPDATE logbooks SET mentor_comment = ?, status = ? WHERE id = ?",
		input.Comment, input.Status, logID,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "บันทึกผลการตรวจผิดพลาด"})
		return
	}

	c.JSON(200, gin.H{"status": 200, "message": "ตรวจบันทึกเรียบร้อย"})
}
