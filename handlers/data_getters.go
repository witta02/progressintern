package handlers

import (
	"database/sql"
	"fmt"
	"internship-backend/config"

	"github.com/gin-gonic/gin"
)

// ========================================================
// USERS
// ========================================================

// GetAllUsersHandler fetches all users
func GetAllUsersHandler(c *gin.Context) {
	rows, err := config.DB.Query("SELECT id, name, email, role, COALESCE(phone,''), COALESCE(profile_image,''), COALESCE(school,''), status, COALESCE(resume_url,'') FROM users")
	if err != nil {
		fmt.Printf("❌ Query error: %v\n", err)
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลผู้ใช้ล้มเหลว"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id int
		var name, email, role, phone, profileImage, school, status, resumeURL string
		rows.Scan(&id, &name, &email, &role, &phone, &profileImage, &school, &status, &resumeURL)
		list = append(list, gin.H{
			"id":            id,
			"name":          name,
			"email":         email,
			"role":          role,
			"phone":         phone,
			"profile_image": profileImage,
			"school":        school,
			"status":        status,
			"resume_url":    resumeURL,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, gin.H{"status": 200, "data": list})
}

// GetUserByIDHandler fetches a single user
func GetUserByIDHandler(c *gin.Context) {
	userID := c.Param("id")
	var id int
	var name, email, role, phone, profileImage, school, status, resumeURL string
	err := config.DB.QueryRow(
		"SELECT id, name, email, role, COALESCE(phone,''), COALESCE(profile_image,''), COALESCE(school,''), status, COALESCE(resume_url,'') FROM users WHERE id = ?",
		userID,
	).Scan(&id, &name, &email, &role, &phone, &profileImage, &school, &status, &resumeURL)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบผู้ใช้"})
		return
	}
	c.JSON(200, gin.H{
		"status": 200,
		"data": gin.H{
			"id": id, "name": name, "email": email, "role": role,
			"phone": phone, "profile_image": profileImage, "school": school,
			"status": status, "resume_url": resumeURL,
		},
	})
}

// ========================================================
// COMPANIES
// ========================================================

// GetAllCompaniesHandler fetches all companies
func GetAllCompaniesHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, user_id, company_name, COALESCE(description,''), COALESCE(address,''), COALESCE(website,'') FROM companies",
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลบริษัทล้มเหลว"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, userID int
		var name, desc, addr, website string
		rows.Scan(&id, &userID, &name, &desc, &addr, &website)
		list = append(list, gin.H{
			"id":           id,
			"user_id":      userID,
			"company_name": name,
			"description":  desc,
			"address":      addr,
			"website":      website,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, gin.H{"status": 200, "data": list})
}

// ========================================================
// APPLICATIONS (with JOINs for richer data)
// ========================================================

// GetAllApplicationsHandler fetches all applications with student + job info
func GetAllApplicationsHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		`SELECT a.id, a.student_id, a.job_posting_id, a.status, a.applied_at,
		        COALESCE(u.name, '') as student_name, COALESCE(u.email, '') as student_email,
		        COALESCE(j.title, '') as job_title, COALESCE(c.company_name, '') as company_name
		 FROM applications a
		 LEFT JOIN users u ON a.student_id = u.id
		 LEFT JOIN job_postings j ON a.job_posting_id = j.id
		 LEFT JOIN companies c ON j.company_id = c.id
		 ORDER BY a.applied_at DESC`,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลใบสมัครล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, stuID, jpID int
		var status, studentName, studentEmail, jobTitle, companyName string
		var appliedAt interface{}
		rows.Scan(&id, &stuID, &jpID, &status, &appliedAt, &studentName, &studentEmail, &jobTitle, &companyName)
		list = append(list, gin.H{
			"id":             id,
			"student_id":     stuID,
			"job_posting_id": jpID,
			"status":         status,
			"applied_at":     appliedAt,
			"student_name":   studentName,
			"student_email":  studentEmail,
			"job_title":      jobTitle,
			"company_name":   companyName,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, gin.H{"status": 200, "data": list})
}

// ========================================================
// INTERNSHIPS
// ========================================================

// GetAllInternshipsHandler fetches all internships with JOINed names
func GetAllInternshipsHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		`SELECT i.id, i.student_id, i.company_id, i.job_posting_id, i.start_date, i.end_date, i.status,
		        COALESCE(u.name, '') as student_name, COALESCE(c.company_name, '') as company_name,
		        COALESCE(j.title, '') as job_title
		 FROM internships i
		 LEFT JOIN users u ON i.student_id = u.id
		 LEFT JOIN companies c ON i.company_id = c.id
		 LEFT JOIN job_postings j ON i.job_posting_id = j.id
		 ORDER BY i.created_at DESC`,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลฝึกงานล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, studentID, companyID, jobID int
		var startDate, endDate, status, studentName, companyName, jobTitle string
		rows.Scan(&id, &studentID, &companyID, &jobID, &startDate, &endDate, &status,
			&studentName, &companyName, &jobTitle)
		list = append(list, gin.H{
			"id":             id,
			"student_id":     studentID,
			"company_id":     companyID,
			"job_posting_id": jobID,
			"start_date":     startDate,
			"end_date":       endDate,
			"status":         status,
			"student_name":   studentName,
			"company_name":   companyName,
			"job_title":      jobTitle,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, gin.H{"status": 200, "data": list})
}

// CreateInternshipHandler creates a new internship record
func CreateInternshipHandler(c *gin.Context) {
	var input struct {
		StudentID    int    `json:"student_id" binding:"required"`
		CompanyID    int    `json:"company_id" binding:"required"`
		JobPostingID int    `json:"job_posting_id" binding:"required"`
		StartDate    string `json:"start_date" binding:"required"`
		EndDate      string `json:"end_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	_, err := config.DB.Exec(
		"INSERT INTO internships (student_id, company_id, job_posting_id, start_date, end_date) VALUES (?, ?, ?, ?, ?)",
		input.StudentID, input.CompanyID, input.JobPostingID, input.StartDate, input.EndDate,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "สร้างข้อมูลฝึกงานไม่สำเร็จ: " + err.Error()})
		return
	}
	c.JSON(201, gin.H{"status": 201, "message": "สร้างข้อมูลฝึกงานสำเร็จ"})
}

// ========================================================
// ATTENDANCE
// ========================================================

// GetAllAttendancesHandler fetches all attendances
func GetAllAttendancesHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		`SELECT id, internship_id, student_id, check_in_time, check_out_time, 
		        COALESCE(latitude, 0), COALESCE(longitude, 0), status, created_at, verification_status 
		 FROM attendances ORDER BY created_at DESC`,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลลงเวลาล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, intID, stuID int
		var lat, lng float64
		var status, verificationStatus string
		var checkIn, checkOut, createdAt interface{}
		rows.Scan(&id, &intID, &stuID, &checkIn, &checkOut, &lat, &lng, &status, &createdAt, &verificationStatus)
		list = append(list, gin.H{
			"id":                  id,
			"internship_id":       intID,
			"student_id":          stuID,
			"check_in_time":       checkIn,
			"check_out_time":      checkOut,
			"latitude":            lat,
			"longitude":           lng,
			"status":              status,
			"created_at":          createdAt,
			"verification_status": verificationStatus,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, gin.H{"status": 200, "data": list})
}

// ========================================================
// LOGBOOKS
// ========================================================

// GetAllLogbooksHandler fetches all logbooks with student name
func GetAllLogbooksHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		`SELECT l.id, l.internship_id, l.title, l.content, 
		        COALESCE(l.attachment_url, ''), COALESCE(l.mentor_comment, ''), l.status,
		        l.created_at, l.updated_at
		 FROM logbooks l
		 ORDER BY l.created_at DESC`,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลบันทึกล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, intID int
		var title, content, attachmentURL, mentorComment, status string
		var createdAt, updatedAt interface{}
		err := rows.Scan(&id, &intID, &title, &content, &attachmentURL, &mentorComment, &status, &createdAt, &updatedAt)
		if err != nil {
			fmt.Printf("Scan error: %v\n", err)
			continue
		}

		// Get student info from internship
		var studentName string
		config.DB.QueryRow(
			"SELECT COALESCE(u.name, '') FROM internships i LEFT JOIN users u ON i.student_id = u.id WHERE i.id = ?",
			intID,
		).Scan(&studentName)

		list = append(list, gin.H{
			"id":             id,
			"internship_id":  intID,
			"title":          title,
			"content":        content,
			"attachment_url": attachmentURL,
			"mentor_comment": mentorComment,
			"status":         status,
			"created_at":     createdAt,
			"updated_at":     updatedAt,
			"student_name":   studentName,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, gin.H{"status": 200, "data": list})
}

// ========================================================
// EVALUATIONS
// ========================================================

// GetAllEvaluationsHandler fetches all evaluations
func GetAllEvaluationsHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		`SELECT e.id, e.internship_id, e.evaluator_id, e.score, COALESCE(e.feedback, ''),
		        e.evaluation_type, e.created_at,
		        COALESCE(u.name, '') as evaluator_name
		 FROM evaluations e
		 LEFT JOIN users u ON e.evaluator_id = u.id
		 ORDER BY e.created_at DESC`,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลประเมินล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, intID, evalID int
		var score float64
		var feedback, evalType, evaluatorName string
		var createdAt interface{}
		rows.Scan(&id, &intID, &evalID, &score, &feedback, &evalType, &createdAt, &evaluatorName)
		list = append(list, gin.H{
			"id":              id,
			"internship_id":   intID,
			"evaluator_id":    evalID,
			"score":           score,
			"feedback":        feedback,
			"evaluation_type": evalType,
			"created_at":      createdAt,
			"evaluator_name":  evaluatorName,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, gin.H{"status": 200, "data": list})
}

// CreateEvaluationHandler creates a new evaluation
func CreateEvaluationHandler(c *gin.Context) {
	var input struct {
		InternshipID   int     `json:"internship_id" binding:"required"`
		Score          float64 `json:"score" binding:"required"`
		Feedback       string  `json:"feedback"`
		EvaluationType string  `json:"evaluation_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	// Get evaluator_id from JWT context
	evaluatorID, exists := c.Get("user_id")
	if !exists {
		c.JSON(401, gin.H{"status": 401, "error": "ไม่พบข้อมูลผู้ใช้"})
		return
	}

	// Check if evaluation already exists
	var existingID int
	err := config.DB.QueryRow(
		"SELECT id FROM evaluations WHERE internship_id = ? AND evaluator_id = ?",
		input.InternshipID, evaluatorID,
	).Scan(&existingID)

	if err == nil {
		// Update existing
		_, err = config.DB.Exec(
			"UPDATE evaluations SET score = ?, feedback = ?, evaluation_type = ? WHERE id = ?",
			input.Score, input.Feedback, input.EvaluationType, existingID,
		)
	} else if err == sql.ErrNoRows {
		// Insert new
		_, err = config.DB.Exec(
			"INSERT INTO evaluations (internship_id, evaluator_id, score, feedback, evaluation_type) VALUES (?, ?, ?, ?, ?)",
			input.InternshipID, evaluatorID, input.Score, input.Feedback, input.EvaluationType,
		)
	}

	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "บันทึกการประเมินไม่สำเร็จ: " + err.Error()})
		return
	}
	c.JSON(201, gin.H{"status": 201, "message": "บันทึกการประเมินสำเร็จ"})
}

// UpdateUserHandler updates user information
func UpdateUserHandler(c *gin.Context) {
	userID := c.Param("id")
	var input struct {
		Name      string `json:"name"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		School    string `json:"school"`
		Status    string `json:"status"`
		ResumeURL string `json:"resume_url"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	_, err := config.DB.Exec(
		`UPDATE users SET 
			name = COALESCE(NULLIF(?,''), name), 
			email = COALESCE(NULLIF(?,''), email), 
			phone = ?, 
			school = ?, 
			status = COALESCE(NULLIF(?,''), status), 
			resume_url = ? 
		 WHERE id = ?`,
		input.Name, input.Email, input.Phone, input.School, input.Status, input.ResumeURL, userID,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "แก้ไขข้อมูลผู้ใช้ไม่สำเร็จ: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": 200, "message": "แก้ไขข้อมูลผู้ใช้สำเร็จ"})
}
