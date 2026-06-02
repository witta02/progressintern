package handlers

import (
	"internship-backend/BackEnd/config"
	"internship-backend/BackEnd/models"

	"github.com/gin-gonic/gin"
)

// ========================================================
// [POST] นักศึกษาส่งใบสมัครงาน
// ========================================================
func ApplyJobHandler(c *gin.Context) {
	var input models.ApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	_, err := config.DB.Exec(
		"INSERT INTO applications (student_id, job_posting_id) VALUES (?, ?)",
		input.StudentID, input.JobPostingID,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "สมัครงานไม่สำเร็จ"})
		return
	}

	c.JSON(201, gin.H{"message": "ส่งใบสมัครเรียบร้อยแล้ว รอการพิจารณา"})
}

// ========================================================
// [GET] บริษัทเรียกดูใบสมัครงานที่ส่งมาหาตัวเอง
// ========================================================
func GetCompanyAppsHandler(c *gin.Context) {
	companyID := c.Param("id")

	rows, err := config.DB.Query(
		"SELECT a.id, u.name, u.email, j.title, a.status FROM applications a "+
			"JOIN users u ON a.student_id = u.id "+
			"JOIN job_postings j ON a.job_posting_id = j.id "+
			"WHERE j.company_id = ?",
		companyID,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "ดึงข้อมูลผิดพลาด"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id int
		var sName, sEmail, jTitle, status string
		rows.Scan(&id, &sName, &sEmail, &jTitle, &status)
		list = append(list, gin.H{
			"application_id": id,
			"student_name":   sName,
			"student_email":  sEmail,
			"job_title":      jTitle,
			"status":         status,
		})
	}

	c.JSON(200, list)
}

// ========================================================
// [PUT] บริษัทอัปเดตสถานะใบสมัคร
// ========================================================
func UpdateAppStatusHandler(c *gin.Context) {
	appID := c.Param("id")
	var input models.UpdateStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "กรุณาระบุสถานะ"})
		return
	}

	_, err := config.DB.Exec("UPDATE applications SET status = ? WHERE id = ?", input.Status, appID)
	if err != nil {
		c.JSON(500, gin.H{"error": "อัปเดตสถานะไม่สำเร็จ"})
		return
	}

	// ถ้าอนุมัติ ให้สร้าง internship record
	if input.Status == "approved" {
		var sID, jpID, cID int
		config.DB.QueryRow("SELECT student_id, job_posting_id FROM applications WHERE id = ?", appID).Scan(&sID, &jpID)
		config.DB.QueryRow("SELECT company_id FROM job_postings WHERE id = ?", jpID).Scan(&cID)
		config.DB.Exec(
			"INSERT INTO internships (student_id, company_id, job_posting_id, start_date, end_date) "+
				"VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 4 MONTH))",
			sID, cID, jpID,
		)
	}

	c.JSON(200, gin.H{"message": "ปรับเปลี่ยนสถานะใบสมัครเรียบร้อย"})
}
