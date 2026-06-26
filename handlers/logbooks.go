package handlers

import (
	"database/sql"
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

	var studentID int
	err := config.DB.QueryRow(
		"SELECT student_id FROM internships WHERE id = ? AND student_id = ? AND status = 'active'",
		input.InternshipID, reqUserID.(int),
	).Scan(&studentID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(403, gin.H{"status": 403, "error": "ไม่พบข้อมูลการฝึกงานที่มีสถานะ Active ของคุณ"})
			return
		}
		c.JSON(500, gin.H{"status": 500, "error": "ตรวจสอบข้อมูลฝึกงานไม่สำเร็จ: " + err.Error()})
		return
	}
	if studentID != reqUserID.(int) {
		c.JSON(403, gin.H{"status": 403, "error": "ไม่พบข้อมูลการฝึกงานที่มีสถานะ Active ของคุณ"})
		return
	}

	result, err := config.DB.Exec(
		"INSERT INTO logbooks (internship_id, student_id, title, content, status, submitted_at) VALUES (?, ?, ?, ?, 'submitted', NOW())",
		input.InternshipID, studentID, input.Title, input.Content,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ส่งรายงานบันทึกไม่สำเร็จ: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(201, gin.H{
		"status":  201,
		"message": "บันทึกรายงานการฝึกงานส่งเรียบร้อย",
		"data": gin.H{
			"id":             id,
			"internship_id":  input.InternshipID,
			"title":          input.Title,
			"content":        input.Content,
			"attachment_url": input.AttachmentURL,
			"mentor_comment": "",
			"status":         "pending",
		},
	})
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
	var title, content string
	err := config.DB.QueryRow(
		`SELECT l.internship_id, i.student_id, l.title, l.content FROM logbooks l
		 JOIN internships i ON l.internship_id = i.id
		 WHERE l.id = ?`,
		logID,
	).Scan(&iID, &sID, &title, &content)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบรายงานบันทึกที่ระบุ"})
		return
	}

	isAuthorized := false
	if roleStr == "admin" {
		isAuthorized = true
	} else if roleStr == "company" {
		var iCompanyID int
		err := config.DB.QueryRow("SELECT company_id FROM internships WHERE id = ?", iID).Scan(&iCompanyID)
		if err == nil {
			var userCompanyID sql.NullInt64
			_ = config.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", userIDInt).Scan(&userCompanyID)
			
			if userCompanyID.Valid && int(userCompanyID.Int64) == iCompanyID {
				isAuthorized = true
			} else {
				var dbUserID int
				_ = config.DB.QueryRow("SELECT user_id FROM companies WHERE id = ?", iCompanyID).Scan(&dbUserID)
				if dbUserID == userIDInt {
					isAuthorized = true
				}
			}
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

	c.JSON(200, gin.H{
		"status":  200,
		"message": "ตรวจบันทึกเรียบร้อย",
		"data": gin.H{
			"id":             logID,
			"internship_id":  iID,
			"title":          title,
			"content":        content,
			"attachment_url": "",
			"mentor_comment": input.Comment,
			"status":         input.Status,
		},
	})
}

// ========================================================
// [PUT] นักศึกษาแก้ไขรายงานประจำวัน (Logbook)
// ========================================================
func UpdateLogbookHandler(c *gin.Context) {
	logID := c.Param("id")
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	if reqRole.(string) != "student" {
		c.JSON(403, gin.H{"status": 403, "error": "เฉพาะนักศึกษาเท่านั้นที่สามารถแก้ไขรายงานบันทึกได้"})
		return
	}

	var input struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "กรอกข้อมูลไม่ครบถ้วน: " + err.Error()})
		return
	}

	// Verify ownership and that status is not approved
	var currentStatus string
	err := config.DB.QueryRow(
		"SELECT status FROM logbooks WHERE id = ? AND student_id = ?",
		logID, reqUserID.(int),
	).Scan(&currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(404, gin.H{"status": 404, "error": "ไม่พบรายงานบันทึกที่ระบุหรือคุณไม่มีสิทธิ์แก้ไข"})
			return
		}
		c.JSON(500, gin.H{"status": 500, "error": "ตรวจสอบข้อมูลบันทึกไม่สำเร็จ: " + err.Error()})
		return
	}

	if currentStatus == "approved" {
		c.JSON(403, gin.H{"status": 403, "error": "ไม่สามารถแก้ไขรายงานบันทึกที่ได้รับการอนุมัติแล้วได้"})
		return
	}

	// Update logbook
	_, err = config.DB.Exec(
		"UPDATE logbooks SET title = ?, content = ?, updated_at = NOW() WHERE id = ?",
		input.Title, input.Content, logID,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "แก้ไขรายงานบันทึกไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"status":  200,
		"message": "แก้ไขรายงานบันทึกสำเร็จ",
		"data": gin.H{
			"id":      logID,
			"title":   input.Title,
			"content": input.Content,
			"status":  currentStatus,
		},
	})
}

// ========================================================
// [DELETE] นักศึกษาลบรายงานประจำวัน (Logbook)
// ========================================================
func DeleteLogbookHandler(c *gin.Context) {
	logID := c.Param("id")
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	if reqRole.(string) != "student" {
		c.JSON(403, gin.H{"status": 403, "error": "เฉพาะนักศึกษาเท่านั้นที่สามารถลบรายงานบันทึกได้"})
		return
	}

	// Verify ownership and status
	var currentStatus string
	err := config.DB.QueryRow(
		"SELECT status FROM logbooks WHERE id = ? AND student_id = ?",
		logID, reqUserID.(int),
	).Scan(&currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(404, gin.H{"status": 404, "error": "ไม่พบรายงานบันทึกที่ระบุหรือคุณไม่มีสิทธิ์ลบ"})
			return
		}
		c.JSON(500, gin.H{"status": 500, "error": "ตรวจสอบข้อมูลบันทึกไม่สำเร็จ: " + err.Error()})
		return
	}

	if currentStatus == "approved" {
		c.JSON(403, gin.H{"status": 403, "error": "ไม่สามารถลบรายงานบันทึกที่ได้รับการอนุมัติแล้วได้"})
		return
	}

	// Delete logbook
	_, err = config.DB.Exec("DELETE FROM logbooks WHERE id = ?", logID)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ลบรายงานบันทึกไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"status":  200,
		"message": "ลบรายงานบันทึกสำเร็จ",
	})
}
