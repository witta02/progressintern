package handlers

import (
	"internship-backend/config"

	"github.com/gin-gonic/gin"
)

// ========================================================
// [POST] บริษัทลงประกาศงาน
// ========================================================
func CreateJobHandler(c *gin.Context) {
	var input struct {
		Title        string `json:"title" binding:"required"`
		Description  string `json:"description" binding:"required"`
		Requirements string `json:"requirements"`
		Benefits     string `json:"benefits"`
		Slots        int    `json:"slots" binding:"required"`
		CheckinTime  string `json:"checkin_time"`
		CheckoutTime string `json:"checkout_time"`
		LatedTime    string `json:"lated_time"`
		WorkDays     string `json:"work_days"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	// Get authenticated user_id from JWT context
	userIDRaw, exists := c.Get("user_id")
	if !exists {
		c.JSON(401, gin.H{"status": 401, "error": "ไม่พบข้อมูลผู้ใช้"})
		return
	}

	// Look up companies.id from the user_id (FK relationship)
	companyID, err := getUserCompanyID(userIDRaw.(int))

	if err != nil {
		// No company profile found — auto-create one
		var userName, userEmail string
		config.DB.QueryRow("SELECT name, email FROM users WHERE id = ?", userIDRaw).Scan(&userName, &userEmail)
		result, insertErr := config.DB.Exec(
			"INSERT INTO companies (user_id, company_name, contact_email) VALUES (?, ?, ?)",
			userIDRaw, userName, userEmail,
		)
		if insertErr != nil {
			c.JSON(500, gin.H{"status": 500, "error": "ไม่พบข้อมูลบริษัท กรุณาสมัครใหม่: " + insertErr.Error()})
			return
		}
		id, _ := result.LastInsertId()
		companyID = int(id)
		
		// Update users.company_id
		_, _ = config.DB.Exec("UPDATE users SET company_id = ? WHERE id = ?", companyID, userIDRaw)
	}

	_, err = config.DB.Exec(
		"INSERT INTO job_postings (company_id, title, description, requirements, benefits, slots, checkin_time, checkout_time, lated_time, work_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')",
		companyID, input.Title, input.Description, input.Requirements, input.Benefits, input.Slots, input.CheckinTime, input.CheckoutTime, input.LatedTime, input.WorkDays,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "สร้างประกาศงานไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(201, gin.H{"status": 201, "message": "เพิ่มประกาศรับสมัครงานสำเร็จ"})
}

// ========================================================
// [GET] ดูงานทั้งหมด (including schedule fields)
// ========================================================
func GetAllJobsHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		`SELECT j.id, j.company_id, j.title, j.description, j.requirements, j.benefits, 
		        j.slots, j.status, COALESCE(j.checkin_time,''), COALESCE(j.checkout_time,''), 
		        COALESCE(j.lated_time,''), COALESCE(j.work_days,''), j.created_at,
		        c.company_name, COALESCE(j.is_deleted, FALSE),
		        (SELECT COUNT(*) FROM applications a WHERE a.job_posting_id = j.id) AS applicant_count
		 FROM job_postings j
		 JOIN companies c ON j.company_id = c.id
		 ORDER BY j.created_at DESC`,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลงานไม่สำเร็จ: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, companyID, slots int
		var title, description, requirements, benefits, status, companyName string
		var checkinTime, checkoutTime, latedTime, workDays string
		var createdAt interface{}
		var isDeleted bool
		var applicantCount int

		rows.Scan(&id, &companyID, &title, &description, &requirements, &benefits, &slots, &status, &checkinTime, &checkoutTime, &latedTime, &workDays, &createdAt, &companyName, &isDeleted, &applicantCount)

		list = append(list, gin.H{
			"id":              id,
			"company_id":      companyID,
			"title":           title,
			"description":     description,
			"requirements":    requirements,
			"benefits":        benefits,
			"slots":           slots,
			"status":          status,
			"checkin_time":    checkinTime,
			"checkout_time":   checkoutTime,
			"lated_time":      latedTime,
			"work_days":       workDays,
			"created_at":      createdAt,
			"company_name":    companyName,
			"is_deleted":      isDeleted,
			"applicant_count": applicantCount,
		})
	}

	if list == nil {
		list = []gin.H{}
	}

	c.JSON(200, gin.H{"status": 200, "message": "Jobs retrieved", "data": list})
}

// ========================================================
// [PUT] บริษัทปิดรับสมัครงาน
// ========================================================
func CloseJobHandler(c *gin.Context) {
	jobID := c.Param("id")

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var jobCompanyID int
	err := config.DB.QueryRow("SELECT company_id FROM job_postings WHERE id = ?", jobID).Scan(&jobCompanyID)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบประกาศงานที่ระบุ"})
		return
	}

	if roleStr != "admin" {
		userCompanyID, userCompErr := getUserCompanyID(userIDInt)
		if userCompErr != nil || userCompanyID != jobCompanyID {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการปิดประกาศงานนี้"})
			return
		}
	}

	var input struct {
		Status string `json:"status"`
	}
	c.ShouldBindJSON(&input)
	status := input.Status
	if status == "" {
		status = "closed"
	}

	_, err = config.DB.Exec("UPDATE job_postings SET status = ? WHERE id = ?", status, jobID)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ปิดรับสมัครงานไม่สำเร็จ"})
		return
	}
	c.JSON(200, gin.H{"status": 200, "message": "ปิดรับสมัครงานเรียบร้อย"})
}

// [DELETE] บริษัทลบประกาศรับสมัครงาน
func DeleteJobHandler(c *gin.Context) {
	jobID := c.Param("id")

	// Get authenticated user_id from JWT context
	userIDRaw, exists := c.Get("user_id")
	if !exists {
		c.JSON(401, gin.H{"status": 401, "error": "ไม่พบข้อมูลผู้ใช้"})
		return
	}

	// Verify that the job posting belongs to the authenticated company user
	var companyID int
	err := config.DB.QueryRow(
		"SELECT company_id FROM job_postings WHERE id = ?", jobID,
	).Scan(&companyID)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบข้อมูลงาน"})
		return
	}

	userCompanyID, userCompErr := getUserCompanyID(userIDRaw.(int))
	if userCompErr != nil || userCompanyID != companyID {
		c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการลบประกาศรับสมัครงานนี้"})
		return
	}

	_, err = config.DB.Exec("UPDATE job_postings SET is_deleted = TRUE WHERE id = ?", jobID)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ลบประกาศรับสมัครงานไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": 200, "message": "ลบประกาศรับสมัครงานเรียบร้อย"})
}

// ========================================================
// [PUT] บริษัทแก้ไขประกาศงาน
// ========================================================
func UpdateJobHandler(c *gin.Context) {
	jobID := c.Param("id")

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var jobCompanyID int
	err := config.DB.QueryRow("SELECT company_id FROM job_postings WHERE id = ?", jobID).Scan(&jobCompanyID)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบประกาศงานที่ระบุ"})
		return
	}

	if roleStr != "admin" {
		userCompanyID, userCompErr := getUserCompanyID(userIDInt)
		if userCompErr != nil || userCompanyID != jobCompanyID {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการแก้ไขประกาศงานนี้"})
			return
		}
	}

	var input struct {
		Title        string `json:"title" binding:"required"`
		Description  string `json:"description" binding:"required"`
		Requirements string `json:"requirements"`
		Benefits     string `json:"benefits"`
		Slots        int    `json:"slots" binding:"required"`
		CheckinTime  string `json:"checkin_time"`
		CheckoutTime string `json:"checkout_time"`
		LatedTime    string `json:"lated_time"`
		WorkDays     string `json:"work_days"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	_, err = config.DB.Exec(
		`UPDATE job_postings 
		 SET title = ?, description = ?, requirements = ?, benefits = ?, slots = ?, 
		     checkin_time = ?, checkout_time = ?, lated_time = ?, work_days = ?
		 WHERE id = ?`,
		input.Title, input.Description, input.Requirements, input.Benefits, input.Slots,
		input.CheckinTime, input.CheckoutTime, input.LatedTime, input.WorkDays, jobID,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "แก้ไขประกาศงานไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": 200, "message": "แก้ไขประกาศงานสำเร็จ"})
}
