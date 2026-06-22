package handlers

import (
	"internship-backend/config"

	"github.com/gin-gonic/gin"
)

// ========================================================
// [POST] นักศึกษาส่งรายงานประจำวัน (Logbook)
// ========================================================
func CreateLogbookHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	if reqRole.(string) != "student" {
		c.JSON(403, gin.H{"status": 403, "error": "เฉพาะนักศึกษาเท่านั้นที่สามารถส่งรายงานบันทึกได้"})
		return
	}

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

	var internshipExists int
	err := config.DB.QueryRow(
		"SELECT COUNT(*) FROM internships WHERE id = ? AND student_id = ? AND status = 'active'",
		input.InternshipID, reqUserID.(int),
	).Scan(&internshipExists)
	if err != nil || internshipExists == 0 {
		c.JSON(403, gin.H{"status": 403, "error": "ไม่พบข้อมูลการฝึกงานที่มีสถานะ Active ของคุณ"})
		return
	}

	_, err = config.DB.Exec(
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

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var iID, sID int
	err := config.DB.QueryRow(
		`SELECT l.internship_id, i.student_id FROM logbooks l
		 JOIN internships i ON l.internship_id = i.id
		 WHERE l.id = ?`,
		logID,
	).Scan(&iID, &sID)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบรายงานบันทึกที่ระบุ"})
		return
	}

	isAuthorized := false
	if roleStr == "admin" {
		isAuthorized = true
	} else if roleStr == "company" {
		var dbUserID int
		err := config.DB.QueryRow(
			`SELECT c.user_id FROM internships i
			 JOIN companies c ON i.company_id = c.id
			 WHERE i.id = ?`,
			iID,
		).Scan(&dbUserID)
		if err == nil && dbUserID == userIDInt {
			isAuthorized = true
		}
	} else if roleStr == "advisor" {
		var advisorSchool, studentSchool string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&advisorSchool)
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", sID).Scan(&studentSchool)
		if advisorSchool != "" && advisorSchool == studentSchool {
			isAuthorized = true
		}
	}

	if !isAuthorized {
		c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ตรวจรายงานบันทึกนี้"})
		return
	}

	var input struct {
		Comment string `json:"comment"`
		Status  string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "กรุณาระบุสถานะผลตรวจ"})
		return
	}

	_, err = config.DB.Exec(
		"UPDATE logbooks SET mentor_comment = ?, status = ?, mentor_id = ?, reviewed_at = NOW() WHERE id = ?",
		input.Comment, input.Status, userIDInt, logID,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "บันทึกผลการตรวจผิดพลาด"})
		return
	}

	c.JSON(200, gin.H{"status": 200, "message": "ตรวจบันทึกเรียบร้อย"})
}
