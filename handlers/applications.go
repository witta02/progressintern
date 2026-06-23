package handlers

import (
	"internship-backend/config"
	"internship-backend/models"

	"github.com/gin-gonic/gin"
)

// ========================================================
// [POST] นักศึกษาส่งใบสมัครงาน
// ========================================================
func ApplyJobHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	if reqRole.(string) != "student" {
		c.JSON(403, gin.H{"status": 403, "error": "เฉพาะนักศึกษาเท่านั้นที่สมัครงานได้"})
		return
	}

	var input models.ApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	if input.StudentID != reqUserID.(int) {
		c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์สมัครงานในนามผู้อื่น"})
		return
	}

	var status string
	err := config.DB.QueryRow("SELECT status FROM users WHERE id = ?", input.StudentID).Scan(&status)
	if err != nil || status != "active" {
		c.JSON(403, gin.H{"status": 403, "error": "บัญชีของคุณยังไม่ได้รับการอนุมัติ"})
		return
	}

	// ตรวจสอบว่าประกาศรับสมัครงานยังไม่เต็ม และยังเปิดอยู่
	var jobStatus string
	var slots int
	err = config.DB.QueryRow("SELECT status, slots FROM job_postings WHERE id = ?", input.JobPostingID).Scan(&jobStatus, &slots)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบประกาศงานที่ระบุ"})
		return
	}
	if jobStatus != "open" {
		c.JSON(400, gin.H{"status": 400, "error": "ตำแหน่งงานนี้ปิดรับสมัครแล้ว"})
		return
	}

	var filledCount int
	err = config.DB.QueryRow(
		"SELECT COUNT(*) FROM internships WHERE job_posting_id = ? AND status IN ('active', 'completed')",
		input.JobPostingID,
	).Scan(&filledCount)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "เกิดข้อผิดพลาดในการตรวจสอบจำนวนผู้สมัคร: " + err.Error()})
		return
	}
	if filledCount >= slots {
		c.JSON(400, gin.H{"status": 400, "error": "ตำแหน่งงานนี้มีผู้ฝึกงานเต็มจำนวนแล้ว"})
		return
	}

	var existingStatus string
	var existingID int
	err = config.DB.QueryRow(
		"SELECT id, status FROM applications WHERE student_id = ? AND job_posting_id = ?",
		input.StudentID, input.JobPostingID,
	).Scan(&existingID, &existingStatus)

	if err == nil {
		if existingStatus == "rejected" {
			_, err = config.DB.Exec(
				"UPDATE applications SET status = 'pending', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
				existingID,
			)
			if err != nil {
				c.JSON(500, gin.H{"status": 500, "error": "ส่งใบสมัครใหม่ไม่สำเร็จ: " + err.Error()})
				return
			}
			c.JSON(200, gin.H{"status": 200, "message": "ส่งใบสมัครใหม่เรียบร้อยแล้ว รอการพิจารณา"})
			return
		} else {
			c.JSON(400, gin.H{"status": 400, "error": "คุณได้สมัครตำแหน่งนี้ไปแล้วและอยู่ในขั้นตอนการพิจารณา"})
			return
		}
	}

	_, err = config.DB.Exec(
		"INSERT INTO applications (student_id, job_posting_id) VALUES (?, ?)",
		input.StudentID, input.JobPostingID,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "สมัครงานไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(201, gin.H{"status": 201, "message": "ส่งใบสมัครเรียบร้อยแล้ว รอการพิจารณา"})
}

// ========================================================
// [GET] บริษัทเรียกดูใบสมัครงานที่ส่งมาหาตัวเอง
// ========================================================
func GetCompanyAppsHandler(c *gin.Context) {
	companyID := c.Param("id")

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	if roleStr != "admin" {
		if roleStr != "company" {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์เข้าถึงข้อมูลใบสมัครของบริษัทนี้"})
			return
		}
		var dbUserID int
		err := config.DB.QueryRow("SELECT user_id FROM companies WHERE id = ?", companyID).Scan(&dbUserID)
		if err != nil || dbUserID != userIDInt {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์เข้าถึงข้อมูลใบสมัครของบริษัทนี้"})
			return
		}
	}

	rows, err := config.DB.Query(
		`SELECT a.id, u.name, u.email, j.title, a.status, a.applied_at
		 FROM applications a
		 JOIN users u ON a.student_id = u.id
		 JOIN job_postings j ON a.job_posting_id = j.id
		 WHERE j.company_id = ?
		 ORDER BY a.applied_at DESC`,
		companyID,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลผิดพลาด"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id int
		var sName, sEmail, jTitle, status string
		var appliedAt interface{}
		rows.Scan(&id, &sName, &sEmail, &jTitle, &status, &appliedAt)
		list = append(list, gin.H{
			"application_id": id,
			"student_name":   sName,
			"student_email":  sEmail,
			"job_title":      jTitle,
			"status":         status,
			"applied_at":     appliedAt,
		})
	}
	if list == nil {
		list = []gin.H{}
	}

	c.JSON(200, gin.H{"status": 200, "data": list})
}

// ========================================================
// [PUT] บริษัทอัปเดตสถานะใบสมัคร
// ========================================================
func UpdateAppStatusHandler(c *gin.Context) {
	appID := c.Param("id")
	var input models.UpdateStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "กรุณาระบุสถานะ"})
		return
	}

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	if roleStr != "admin" {
		if roleStr != "company" {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการจัดการใบสมัครนี้"})
			return
		}
		var ownerUserID int
		err := config.DB.QueryRow(
			`SELECT c.user_id FROM applications a
			 JOIN job_postings j ON a.job_posting_id = j.id
			 JOIN companies c ON j.company_id = c.id
			 WHERE a.id = ?`,
			appID,
		).Scan(&ownerUserID)
		if err != nil || ownerUserID != userIDInt {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการจัดการใบสมัครนี้"})
			return
		}
	}

	// ถ้าอนุมัติ ให้ตรวจสอบว่านักศึกษามีที่ฝึกงานอยู่แล้วหรือไม่
	if input.Status == "approved" {
		tx, err := config.DB.Begin()
		if err != nil {
			c.JSON(500, gin.H{"status": 500, "error": "ไม่สามารถทำรายการได้: " + err.Error()})
			return
		}
		defer tx.Rollback()

		var sID, jpID, cID int
		err = tx.QueryRow("SELECT student_id, job_posting_id FROM applications WHERE id = ?", appID).Scan(&sID, &jpID)
		if err != nil {
			c.JSON(404, gin.H{"status": 404, "error": "ไม่พบข้อมูลใบสมัคร"})
			return
		}

		// ตรวจสอบว่ามีประวัติฝึกงานที่กำลังดำเนินอยู่ (active) หรือไม่
		var existingInternshipID int
		err = tx.QueryRow("SELECT id FROM internships WHERE student_id = ? AND status = 'active'", sID).Scan(&existingInternshipID)
		if err == nil {
			// นักศึกษามีที่ฝึกงานแล้ว -> ทำการปฏิเสธใบสมัครนี้โดยอัตโนมัติ (auto reject)
			tx.Exec("UPDATE applications SET status = 'rejected' WHERE id = ?", appID)
			tx.Commit()
			c.JSON(400, gin.H{"status": 400, "error": "นักศึกษาคนนี้ มีสถานที่ฝึกงานแล้ว"})
			return
		}

		// อัปเดตสถานะใบสมัครเป็น approved
		_, err = tx.Exec("UPDATE applications SET status = 'approved' WHERE id = ?", appID)
		if err != nil {
			c.JSON(500, gin.H{"status": 500, "error": "อนุมัติใบสมัครไม่สำเร็จ"})
			return
		}

		// ลบใบสมัครอื่นๆ ของนักศึกษาคนนี้ออก
		_, err = tx.Exec("DELETE FROM applications WHERE student_id = ? AND id <> ?", sID, appID)
		if err != nil {
			c.JSON(500, gin.H{"status": 500, "error": "ไม่สามารถลบใบสมัครอื่นได้: " + err.Error()})
			return
		}

		// สร้างข้อมูลฝึกงานใหม่
		err = tx.QueryRow("SELECT company_id FROM job_postings WHERE id = ?", jpID).Scan(&cID)
		if err != nil {
			c.JSON(500, gin.H{"status": 500, "error": "ไม่พบข้อมูลงาน"})
			return
		}

		_, err = tx.Exec(
			"INSERT INTO internships (student_id, company_id, job_posting_id, start_date, end_date) "+
				"VALUES (?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 4 MONTH))",
			sID, cID, jpID,
		)
		if err != nil {
			c.JSON(500, gin.H{"status": 500, "error": "สร้างประวัติการฝึกงานไม่สำเร็จ: " + err.Error()})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(500, gin.H{"status": 500, "error": "บันทึกรายการไม่สำเร็จ: " + err.Error()})
			return
		}
	} else {
		// ถ้าไม่ใช่ approved ให้อัปเดตสถานะตามปกติ
		_, err := config.DB.Exec("UPDATE applications SET status = ? WHERE id = ?", input.Status, appID)
		if err != nil {
			c.JSON(500, gin.H{"status": 500, "error": "อัปเดตสถานะไม่สำเร็จ"})
			return
		}
	}

	c.JSON(200, gin.H{"status": 200, "message": "ปรับเปลี่ยนสถานะใบสมัครเรียบร้อย"})
}
