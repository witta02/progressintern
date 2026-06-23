package handlers

import (
	"database/sql"
	"fmt"
	"internship-backend/config"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ========================================================
// USERS
// ========================================================

// GetAllUsersHandler fetches all users with role-based filtering
func GetAllUsersHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	var rows *sql.Rows
	var err error

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	if roleStr == "admin" {
		rows, err = config.DB.Query("SELECT id, name, email, role, COALESCE(phone,''), COALESCE(profile_image,''), COALESCE(school,''), status, COALESCE(resume_url,''), COALESCE(intro,''), COALESCE(field,''), advisor_id FROM users")
	} else if roleStr == "advisor" {
		var school string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&school)

		rows, err = config.DB.Query(
			`SELECT id, name, email, role, COALESCE(phone,''), COALESCE(profile_image,''), COALESCE(school,''), status, COALESCE(resume_url,''), COALESCE(intro,''), COALESCE(field,''), advisor_id 
			 FROM users 
			 WHERE id = ? 
			    OR (school = ? AND school <> '' AND role IN ('student', 'advisor')) 
			    OR role = 'company' 
			    OR role = 'admin'`,
			userIDInt, school,
		)
	} else if roleStr == "company" {
		rows, err = config.DB.Query(
			`SELECT DISTINCT u.id, u.name, u.email, u.role, COALESCE(u.phone,''), COALESCE(u.profile_image,''), COALESCE(u.school,''), u.status, COALESCE(u.resume_url,''), COALESCE(u.intro,''), COALESCE(u.field,''), u.advisor_id
			 FROM users u
			 LEFT JOIN companies c ON c.user_id = ?
			 LEFT JOIN job_postings j ON j.company_id = c.id
			 LEFT JOIN applications a ON a.job_posting_id = j.id AND a.student_id = u.id
			 LEFT JOIN internships i ON i.company_id = c.id AND i.student_id = u.id
			 WHERE u.id = ? 
			    OR u.role = 'admin'
			    OR (u.role = 'student' AND (a.id IS NOT NULL OR i.id IS NOT NULL))
			    OR (u.role = 'advisor' AND u.school IN (
			         SELECT DISTINCT school FROM users s 
			         LEFT JOIN applications sa ON sa.student_id = s.id AND sa.job_posting_id = j.id
			         LEFT JOIN internships si ON si.student_id = s.id AND si.company_id = c.id
			         WHERE s.role = 'student' AND (sa.id IS NOT NULL OR si.id IS NOT NULL)
			    ))`,
			userIDInt, userIDInt,
		)
	} else { // student
		var school string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&school)

		rows, err = config.DB.Query(
			`SELECT DISTINCT u.id, u.name, u.email, u.role, COALESCE(u.phone,''), COALESCE(u.profile_image,''), COALESCE(u.school,''), u.status, COALESCE(u.resume_url,''), COALESCE(u.intro,''), COALESCE(u.field,''), u.advisor_id
			 FROM users u
			 LEFT JOIN companies c ON c.user_id = u.id
			 LEFT JOIN job_postings j ON j.company_id = c.id
			 LEFT JOIN applications a ON a.job_posting_id = j.id AND a.student_id = ?
			 LEFT JOIN internships i ON i.company_id = c.id AND i.student_id = ?
			 WHERE u.id = ?
			    OR u.role = 'admin'
			    OR (u.role = 'advisor' AND u.school = ? AND u.school <> '')
			    OR (u.role = 'company' AND (a.id IS NOT NULL OR i.id IS NOT NULL))`,
			userIDInt, userIDInt, userIDInt, school,
		)
	}

	if err != nil {
		fmt.Printf("❌ Query error: %v\n", err)
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลผู้ใช้ล้มเหลว"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id int
		var name, email, role, phone, profileImage, school, status, resumeURL, intro, field string
		var advisorID sql.NullInt64
		rows.Scan(&id, &name, &email, &role, &phone, &profileImage, &school, &status, &resumeURL, &intro, &field, &advisorID)

		var advIDVal interface{} = nil
		if advisorID.Valid {
			advIDVal = advisorID.Int64
		}

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
			"intro":         intro,
			"field":         field,
			"advisor_id":    advIDVal,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, gin.H{"status": 200, "data": list})
}

// GetUserByIDHandler fetches a single user with authorization check
func GetUserByIDHandler(c *gin.Context) {
	userID := c.Param("id")

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var targetUserIDInt int
	fmt.Sscanf(userID, "%d", &targetUserIDInt)

	isAuthorized := false
	if roleStr == "admin" || userIDInt == targetUserIDInt {
		isAuthorized = true
	} else if roleStr == "advisor" {
		var reqSchool, targetSchool, targetRole string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&reqSchool)
		config.DB.QueryRow("SELECT COALESCE(school,''), role FROM users WHERE id = ?", targetUserIDInt).Scan(&targetSchool, &targetRole)
		if reqSchool != "" && reqSchool == targetSchool && (targetRole == "student" || targetRole == "advisor") {
			isAuthorized = true
		}
	} else if roleStr == "company" {
		var targetRole string
		config.DB.QueryRow("SELECT role FROM users WHERE id = ?", targetUserIDInt).Scan(&targetRole)
		if targetRole == "admin" {
			isAuthorized = true
		} else {
			var hasRelation int
			config.DB.QueryRow(
				`SELECT COUNT(*) FROM users u
				 LEFT JOIN companies c ON c.user_id = ?
				 LEFT JOIN job_postings j ON j.company_id = c.id
				 LEFT JOIN applications a ON a.job_posting_id = j.id AND a.student_id = u.id
				 LEFT JOIN internships i ON i.company_id = c.id AND i.student_id = u.id
				 WHERE u.id = ? AND (a.id IS NOT NULL OR i.id IS NOT NULL)`,
				userIDInt, targetUserIDInt,
			).Scan(&hasRelation)
			if hasRelation > 0 {
				isAuthorized = true
			}
		}
	} else if roleStr == "student" {
		var targetRole string
		config.DB.QueryRow("SELECT role FROM users WHERE id = ?", targetUserIDInt).Scan(&targetRole)
		if targetRole == "admin" {
			isAuthorized = true
		} else if targetRole == "advisor" {
			var reqSchool, targetSchool string
			config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&reqSchool)
			config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", targetUserIDInt).Scan(&targetSchool)
			if reqSchool != "" && reqSchool == targetSchool {
				isAuthorized = true
			}
		} else if targetRole == "company" {
			var hasRelation int
			config.DB.QueryRow(
				`SELECT COUNT(*) FROM companies c
				 LEFT JOIN job_postings j ON j.company_id = c.id
				 LEFT JOIN applications a ON a.job_posting_id = j.id AND a.student_id = ?
				 LEFT JOIN internships i ON i.company_id = c.id AND i.student_id = ?
				 WHERE c.user_id = ? AND (a.id IS NOT NULL OR i.id IS NOT NULL)`,
				userIDInt, userIDInt, targetUserIDInt,
			).Scan(&hasRelation)
			if hasRelation > 0 {
				isAuthorized = true
			}
		}
	}

	if !isAuthorized {
		c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้นี้"})
		return
	}

	var id int
	var name, email, role, phone, profileImage, school, status, resumeURL, intro, field string
	var advisorID sql.NullInt64
	err := config.DB.QueryRow(
		"SELECT id, name, email, role, COALESCE(phone,''), COALESCE(profile_image,''), COALESCE(school,''), status, COALESCE(resume_url,''), COALESCE(intro,''), COALESCE(field,''), advisor_id FROM users WHERE id = ?",
		targetUserIDInt,
	).Scan(&id, &name, &email, &role, &phone, &profileImage, &school, &status, &resumeURL, &intro, &field, &advisorID)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบผู้ใช้"})
		return
	}

	var advIDVal interface{} = nil
	if advisorID.Valid {
		advIDVal = advisorID.Int64
	}

	c.JSON(200, gin.H{
		"status": 200,
		"data": gin.H{
			"id": id, "name": name, "email": email, "role": role,
			"phone": phone, "profile_image": profileImage, "school": school,
			"status": status, "resume_url": resumeURL, "intro": intro, "field": field,
			"advisor_id": advIDVal,
		},
	})
}

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

// GetAllApplicationsHandler fetches all applications with student + job info, filtered by role
// GetAllApplicationsHandler fetches all applications with student + job info, filtered by role
func GetAllApplicationsHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var rows *sql.Rows
	var err error

	if roleStr == "admin" {
		rows, err = config.DB.Query(
			`SELECT a.id, a.student_id, a.job_posting_id, a.status, a.applied_at, a.updated_at,
			        COALESCE(u.name, '') as student_name, COALESCE(u.email, '') as student_email,
			        COALESCE(j.title, '') as job_title, COALESCE(c.company_name, '') as company_name
			 FROM applications a
			 LEFT JOIN users u ON a.student_id = u.id
			 LEFT JOIN job_postings j ON a.job_posting_id = j.id
			 LEFT JOIN companies c ON j.company_id = c.id
			 ORDER BY a.applied_at DESC`,
		)
	} else if roleStr == "advisor" {
		var school string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&school)

		rows, err = config.DB.Query(
			`SELECT a.id, a.student_id, a.job_posting_id, a.status, a.applied_at, a.updated_at,
			        COALESCE(u.name, '') as student_name, COALESCE(u.email, '') as student_email,
			        COALESCE(j.title, '') as job_title, COALESCE(c.company_name, '') as company_name
			 FROM applications a
			 LEFT JOIN users u ON a.student_id = u.id
			 LEFT JOIN job_postings j ON a.job_posting_id = j.id
			 LEFT JOIN companies c ON j.company_id = c.id
			 WHERE u.school = ? AND u.school <> ''
			 ORDER BY a.applied_at DESC`,
			school,
		)
	} else if roleStr == "company" {
		rows, err = config.DB.Query(
			`SELECT a.id, a.student_id, a.job_posting_id, a.status, a.applied_at, a.updated_at,
			        COALESCE(u.name, '') as student_name, COALESCE(u.email, '') as student_email,
			        COALESCE(j.title, '') as job_title, COALESCE(c.company_name, '') as company_name
			 FROM applications a
			 LEFT JOIN users u ON a.student_id = u.id
			 LEFT JOIN job_postings j ON a.job_posting_id = j.id
			 LEFT JOIN companies c ON j.company_id = c.id
			 WHERE c.user_id = ?
			 ORDER BY a.applied_at DESC`,
			userIDInt,
		)
	} else { // student
		rows, err = config.DB.Query(
			`SELECT a.id, a.student_id, a.job_posting_id, a.status, a.applied_at, a.updated_at,
			        COALESCE(u.name, '') as student_name, COALESCE(u.email, '') as student_email,
			        COALESCE(j.title, '') as job_title, COALESCE(c.company_name, '') as company_name
			 FROM applications a
			 LEFT JOIN users u ON a.student_id = u.id
			 LEFT JOIN job_postings j ON a.job_posting_id = j.id
			 LEFT JOIN companies c ON j.company_id = c.id
			 WHERE a.student_id = ?
			 ORDER BY a.applied_at DESC`,
			userIDInt,
		)
	}

	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลใบสมัครล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, stuID, jpID int
		var status, studentName, studentEmail, jobTitle, companyName string
		var appliedAt, updatedAt interface{}
		rows.Scan(&id, &stuID, &jpID, &status, &appliedAt, &updatedAt, &studentName, &studentEmail, &jobTitle, &companyName)
		list = append(list, gin.H{
			"id":             id,
			"student_id":     stuID,
			"job_posting_id": jpID,
			"status":         status,
			"applied_at":     appliedAt,
			"updated_at":     updatedAt,
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

// GetAllInternshipsHandler fetches all internships with JOINed names, filtered by role
func GetAllInternshipsHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var rows *sql.Rows
	var err error

	if roleStr == "admin" {
		rows, err = config.DB.Query(
			`SELECT i.id, i.student_id, i.company_id, i.job_posting_id, i.start_date, i.end_date, i.status,
			        COALESCE(u.name, '') as student_name, COALESCE(c.company_name, '') as company_name,
			        COALESCE(j.title, '') as job_title
			 FROM internships i
			 LEFT JOIN users u ON i.student_id = u.id
			 LEFT JOIN companies c ON i.company_id = c.id
			 LEFT JOIN job_postings j ON i.job_posting_id = j.id
			 ORDER BY i.created_at DESC`,
		)
	} else if roleStr == "advisor" {
		var school string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&school)

		rows, err = config.DB.Query(
			`SELECT i.id, i.student_id, i.company_id, i.job_posting_id, i.start_date, i.end_date, i.status,
			        COALESCE(u.name, '') as student_name, COALESCE(c.company_name, '') as company_name,
			        COALESCE(j.title, '') as job_title
			 FROM internships i
			 LEFT JOIN users u ON i.student_id = u.id
			 LEFT JOIN companies c ON i.company_id = c.id
			 LEFT JOIN job_postings j ON i.job_posting_id = j.id
			 WHERE u.school = ? AND u.school <> ''
			 ORDER BY i.created_at DESC`,
			school,
		)
	} else if roleStr == "company" {
		rows, err = config.DB.Query(
			`SELECT i.id, i.student_id, i.company_id, i.job_posting_id, i.start_date, i.end_date, i.status,
			        COALESCE(u.name, '') as student_name, COALESCE(c.company_name, '') as company_name,
			        COALESCE(j.title, '') as job_title
			 FROM internships i
			 LEFT JOIN users u ON i.student_id = u.id
			 LEFT JOIN companies c ON i.company_id = c.id
			 LEFT JOIN job_postings j ON i.job_posting_id = j.id
			 WHERE c.user_id = ?
			 ORDER BY i.created_at DESC`,
			userIDInt,
		)
	} else { // student
		rows, err = config.DB.Query(
			`SELECT i.id, i.student_id, i.company_id, i.job_posting_id, i.start_date, i.end_date, i.status,
			        COALESCE(u.name, '') as student_name, COALESCE(c.company_name, '') as company_name,
			        COALESCE(j.title, '') as job_title
			 FROM internships i
			 LEFT JOIN users u ON i.student_id = u.id
			 LEFT JOIN companies c ON i.company_id = c.id
			 LEFT JOIN job_postings j ON i.job_posting_id = j.id
			 WHERE i.student_id = ?
			 ORDER BY i.created_at DESC`,
			userIDInt,
		)
	}

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

// CreateInternshipHandler creates a new internship record with authorization check
func CreateInternshipHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	roleStr := reqRole.(string)
	if roleStr != "admin" && roleStr != "company" {
		c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการสร้างข้อมูลการฝึกงาน"})
		return
	}

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

// GetAllAttendancesHandler fetches all attendances, filtered by role
func GetAllAttendancesHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var rows *sql.Rows
	var err error

	if roleStr == "admin" {
		rows, err = config.DB.Query(
			`SELECT id, internship_id, student_id, check_in_time, check_out_time, 
			        COALESCE(latitude, 0), COALESCE(longitude, 0), 
			        COALESCE(checkout_latitude, 0), COALESCE(checkout_longitude, 0),
			        status, created_at, verification_status 
			 FROM attendances ORDER BY created_at DESC`,
		)
	} else if roleStr == "advisor" {
		var school string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&school)

		rows, err = config.DB.Query(
			`SELECT a.id, a.internship_id, a.student_id, a.check_in_time, a.check_out_time, 
			        COALESCE(a.latitude, 0), COALESCE(a.longitude, 0), 
			        COALESCE(a.checkout_latitude, 0), COALESCE(a.checkout_longitude, 0),
			        a.status, a.created_at, a.verification_status 
			 FROM attendances a
			 LEFT JOIN users u ON a.student_id = u.id
			 WHERE u.school = ? AND u.school <> ''
			 ORDER BY a.created_at DESC`,
			school,
		)
	} else if roleStr == "company" {
		rows, err = config.DB.Query(
			`SELECT a.id, a.internship_id, a.student_id, a.check_in_time, a.check_out_time, 
			        COALESCE(a.latitude, 0), COALESCE(a.longitude, 0), 
			        COALESCE(a.checkout_latitude, 0), COALESCE(checkout_longitude, 0),
			        a.status, a.created_at, a.verification_status 
			 FROM attendances a
			 LEFT JOIN internships i ON a.internship_id = i.id
			 LEFT JOIN companies c ON i.company_id = c.id
			 WHERE c.user_id = ?
			 ORDER BY a.created_at DESC`,
			userIDInt,
		)
	} else { // student
		rows, err = config.DB.Query(
			`SELECT id, internship_id, student_id, check_in_time, check_out_time, 
			        COALESCE(latitude, 0), COALESCE(longitude, 0), 
			        COALESCE(checkout_latitude, 0), COALESCE(checkout_longitude, 0),
			        status, created_at, verification_status 
			 FROM attendances 
			 WHERE student_id = ?
			 ORDER BY created_at DESC`,
			userIDInt,
		)
	}

	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ดึงข้อมูลลงเวลาล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, intID, stuID int
		var lat, lng, outLat, outLng float64
		var status, verificationStatus string
		var checkIn, checkOut, createdAt interface{}
		rows.Scan(&id, &intID, &stuID, &checkIn, &checkOut, &lat, &lng, &outLat, &outLng, &status, &createdAt, &verificationStatus)
		list = append(list, gin.H{
			"id":                  id,
			"internship_id":       intID,
			"student_id":          stuID,
			"check_in_time":       checkIn,
			"check_out_time":      checkOut,
			"latitude":            lat,
			"longitude":           lng,
			"checkout_latitude":   outLat,
			"checkout_longitude":  outLng,
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

// GetAllLogbooksHandler fetches all logbooks with student name, filtered by role
func GetAllLogbooksHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var rows *sql.Rows
	var err error

	if roleStr == "admin" {
		rows, err = config.DB.Query(
			`SELECT l.id, l.internship_id, l.title, l.content, 
			        '' AS attachment_url, COALESCE(l.mentor_comment, ''), l.status,
			        l.created_at, l.updated_at
			 FROM logbooks l
			 ORDER BY l.created_at DESC`,
		)
	} else if roleStr == "advisor" {
		var school string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&school)

		rows, err = config.DB.Query(
			`SELECT l.id, l.internship_id, l.title, l.content, 
			        '' AS attachment_url, COALESCE(l.mentor_comment, ''), l.status,
			        l.created_at, l.updated_at
			 FROM logbooks l
			 LEFT JOIN internships i ON l.internship_id = i.id
			 LEFT JOIN users u ON i.student_id = u.id
			 WHERE u.school = ? AND u.school <> ''
			 ORDER BY l.created_at DESC`,
			school,
		)
	} else if roleStr == "company" {
		rows, err = config.DB.Query(
			`SELECT l.id, l.internship_id, l.title, l.content, 
			        '' AS attachment_url, COALESCE(l.mentor_comment, ''), l.status,
			        l.created_at, l.updated_at
			 FROM logbooks l
			 LEFT JOIN internships i ON l.internship_id = i.id
			 LEFT JOIN companies c ON i.company_id = c.id
			 WHERE c.user_id = ?
			 ORDER BY l.created_at DESC`,
			userIDInt,
		)
	} else { // student
		rows, err = config.DB.Query(
			`SELECT l.id, l.internship_id, l.title, l.content, 
			        '' AS attachment_url, COALESCE(l.mentor_comment, ''), l.status,
			        l.created_at, l.updated_at
			 FROM logbooks l
			 LEFT JOIN internships i ON l.internship_id = i.id
			 WHERE i.student_id = ?
			 ORDER BY l.created_at DESC`,
			userIDInt,
		)
	}

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
		if status == "draft" || status == "submitted" {
			status = "pending"
		}

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

// GetAllEvaluationsHandler fetches all evaluations, filtered by role
func GetAllEvaluationsHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var rows *sql.Rows
	var err error

	if roleStr == "admin" {
		rows, err = config.DB.Query(
			`SELECT e.id, e.internship_id, e.evaluator_id, e.score, COALESCE(e.feedback, ''),
			        e.evaluation_type, e.created_at,
			        COALESCE(u.name, '') as evaluator_name
			 FROM evaluations e
			 LEFT JOIN users u ON e.evaluator_id = u.id
			 ORDER BY e.created_at DESC`,
		)
	} else if roleStr == "advisor" {
		var school string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&school)

		rows, err = config.DB.Query(
			`SELECT e.id, e.internship_id, e.evaluator_id, e.score, COALESCE(e.feedback, ''),
			        e.evaluation_type, e.created_at,
			        COALESCE(u.name, '') as evaluator_name
			 FROM evaluations e
			 LEFT JOIN users u ON e.evaluator_id = u.id
			 LEFT JOIN internships i ON e.internship_id = i.id
			 LEFT JOIN users s ON i.student_id = s.id
			 WHERE s.school = ? AND s.school <> ''
			 ORDER BY e.created_at DESC`,
			school,
		)
	} else if roleStr == "company" {
		rows, err = config.DB.Query(
			`SELECT e.id, e.internship_id, e.evaluator_id, e.score, COALESCE(e.feedback, ''),
			        e.evaluation_type, e.created_at,
			        COALESCE(u.name, '') as evaluator_name
			 FROM evaluations e
			 LEFT JOIN users u ON e.evaluator_id = u.id
			 LEFT JOIN internships i ON e.internship_id = i.id
			 LEFT JOIN companies c ON i.company_id = c.id
			 WHERE c.user_id = ?
			 ORDER BY e.created_at DESC`,
			userIDInt,
		)
	} else { // student
		rows, err = config.DB.Query(
			`SELECT e.id, e.internship_id, e.evaluator_id, e.score, COALESCE(e.feedback, ''),
			        e.evaluation_type, e.created_at,
			        COALESCE(u.name, '') as evaluator_name
			 FROM evaluations e
			 LEFT JOIN users u ON e.evaluator_id = u.id
			 LEFT JOIN internships i ON e.internship_id = i.id
			 WHERE i.student_id = ?
			 ORDER BY e.created_at DESC`,
			userIDInt,
		)
	}

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

// UpdateUserHandler updates user information with strict role and privilege validation
func UpdateUserHandler(c *gin.Context) {
	userID := c.Param("id")
	var input struct {
		Name      string `json:"name"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		School    string `json:"school"`
		Status    string `json:"status"`
		ResumeURL string `json:"resume_url"`
		Intro     string `json:"intro"`
		Field     string `json:"field"`
		AdvisorID *int   `json:"advisor_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var targetUserIDInt int
	fmt.Sscanf(userID, "%d", &targetUserIDInt)

	var targetRole, targetSchool, currentStatus string
	err := config.DB.QueryRow("SELECT role, COALESCE(school,''), status FROM users WHERE id = ?", targetUserIDInt).Scan(&targetRole, &targetSchool, &currentStatus)
	if err != nil {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบผู้ใช้"})
		return
	}

	if roleStr != "admin" && userIDInt != targetUserIDInt {
		if roleStr == "advisor" && targetRole == "student" {
			var advisorSchool string
			config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&advisorSchool)

			if targetSchool != "" && targetSchool != advisorSchool {
				c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์แก้ไขข้อมูลนักศึกษานอกสังกัด"})
				return
			}

			var query string
			var args []interface{}
			if input.AdvisorID != nil {
				if *input.AdvisorID == 0 {
					query = "UPDATE users SET status = COALESCE(NULLIF(?,''), status), school = ?, advisor_id = NULL WHERE id = ?"
					args = []interface{}{input.Status, advisorSchool, targetUserIDInt}
				} else {
					query = "UPDATE users SET status = COALESCE(NULLIF(?,''), status), school = ?, advisor_id = ? WHERE id = ?"
					args = []interface{}{input.Status, advisorSchool, *input.AdvisorID, targetUserIDInt}
				}
			} else {
				query = "UPDATE users SET status = COALESCE(NULLIF(?,''), status), school = ? WHERE id = ?"
				args = []interface{}{input.Status, advisorSchool, targetUserIDInt}
			}

			_, err = config.DB.Exec(query, args...)
			if err != nil {
				c.JSON(500, gin.H{"status": 500, "error": "อัปเดตข้อมูลนักศึกษาไม่สำเร็จ: " + err.Error()})
				return
			}

			// Sync supervisor_id in internships table for active internship
			if input.AdvisorID != nil {
				var supervisorVal interface{} = *input.AdvisorID
				if *input.AdvisorID == 0 {
					supervisorVal = nil
				}
				_, _ = config.DB.Exec(
					"UPDATE internships SET supervisor_id = ? WHERE student_id = ? AND status = 'active'",
					supervisorVal, targetUserIDInt,
				)
			}

			c.JSON(200, gin.H{"status": 200, "message": "อนุมัติ/แก้ไขข้อมูลนักศึกษาสำเร็จ"})
			return
		}

		c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้อื่น"})
		return
	}

	if roleStr != "admin" && userIDInt == targetUserIDInt {
		if input.Status != "" && input.Status != currentStatus {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์แก้ไขสถานะของตนเอง"})
			return
		}

		_, err = config.DB.Exec(
			`UPDATE users SET 
				name = COALESCE(NULLIF(?,''), name), 
				email = COALESCE(NULLIF(?,''), email), 
				phone = ?, 
				school = ?, 
				resume_url = ?,
				intro = ?,
				field = ?
			 WHERE id = ?`,
			input.Name, input.Email, input.Phone, input.School, input.ResumeURL, input.Intro, input.Field, userIDInt,
		)
	} else {
		var query string
		var args []interface{}
		if input.AdvisorID != nil {
			var advVal interface{} = *input.AdvisorID
			if *input.AdvisorID == 0 {
				advVal = nil
			}
			query = `UPDATE users SET 
				name = COALESCE(NULLIF(?,''), name), 
				email = COALESCE(NULLIF(?,''), email), 
				phone = ?, 
				school = ?, 
				status = COALESCE(NULLIF(?,''), status), 
				resume_url = ?,
				intro = ?,
				field = ?,
				advisor_id = ?
			 WHERE id = ?`
			args = []interface{}{input.Name, input.Email, input.Phone, input.School, input.Status, input.ResumeURL, input.Intro, input.Field, advVal, targetUserIDInt}
		} else {
			query = `UPDATE users SET 
				name = COALESCE(NULLIF(?,''), name), 
				email = COALESCE(NULLIF(?,''), email), 
				phone = ?, 
				school = ?, 
				status = COALESCE(NULLIF(?,''), status), 
				resume_url = ?,
				intro = ?,
				field = ?
			 WHERE id = ?`
			args = []interface{}{input.Name, input.Email, input.Phone, input.School, input.Status, input.ResumeURL, input.Intro, input.Field, targetUserIDInt}
		}

		_, err = config.DB.Exec(query, args...)

		// Sync supervisor_id in internships table for active internship
		if err == nil && input.AdvisorID != nil && targetRole == "student" {
			var supervisorVal interface{} = *input.AdvisorID
			if *input.AdvisorID == 0 {
				supervisorVal = nil
			}
			_, _ = config.DB.Exec(
				"UPDATE internships SET supervisor_id = ? WHERE student_id = ? AND status = 'active'",
				supervisorVal, targetUserIDInt,
			)
		}
	}

	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "แก้ไขข้อมูลผู้ใช้ไม่สำเร็จ: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": 200, "message": "แก้ไขข้อมูลผู้ใช้สำเร็จ"})
}

// UpdateInternshipStatusHandler updates status of an internship (e.g. active, completed, terminated)
func UpdateInternshipStatusHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")
	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	internshipIDStr := c.Param("id")
	internshipID, err := strconv.Atoi(internshipIDStr)
	if err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ID การฝึกงานไม่ถูกต้อง"})
		return
	}

	var input struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	// Verify authorization
	if roleStr != "admin" {
		if roleStr != "company" {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลการฝึกงาน"})
			return
		}
		// If role is company, check if the company owns this internship
		var companyUserID int
		err = config.DB.QueryRow(
			"SELECT c.user_id FROM internships i LEFT JOIN companies c ON i.company_id = c.id WHERE i.id = ?",
			internshipID,
		).Scan(&companyUserID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(404, gin.H{"status": 404, "error": "ไม่พบข้อมูลการฝึกงาน"})
				return
			}
			c.JSON(500, gin.H{"status": 500, "error": "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: " + err.Error()})
			return
		}
		if companyUserID != userIDInt {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการจัดการข้อมูลการฝึกงานนี้"})
			return
		}
	}

	// Update status
	_, err = config.DB.Exec(
		"UPDATE internships SET status = ? WHERE id = ?",
		input.Status, internshipID,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "อัปเดตสถานะฝึกงานไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": 200, "message": "อัปเดตสถานะฝึกงานสำเร็จ"})
}
