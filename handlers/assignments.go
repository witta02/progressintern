package handlers

import (
	"database/sql"
	"fmt"
	"internship-backend/config"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ========================================================
// [POST] สร้างงาน/การบ้าน (Create Assignment)
// ========================================================
func CreateAssignmentHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	if roleStr != "advisor" && roleStr != "company" && roleStr != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการสร้างงานที่มอบหมาย"})
		return
	}

	var input struct {
		Title        string `json:"title" binding:"required"`
		Description  string `json:"description"`
		DueDate      string `json:"due_date"` // YYYY-MM-DD HH:MM:SS or RFC3339
		Points       int    `json:"points"`
		StudentID    *int   `json:"student_id"`
		JobPostingID *int   `json:"job_posting_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	var dueDateVal *time.Time = nil
	if input.DueDate != "" {
		parsedTime, err := time.Parse(time.RFC3339, input.DueDate)
		if err != nil {
			parsedTime, err = time.Parse("2006-01-02 15:04:05", input.DueDate)
			if err != nil {
				parsedTime, err = time.Parse("2006-01-02", input.DueDate)
			}
		}
		if err == nil {
			dueDateVal = &parsedTime
		}
	}

	points := input.Points
	if points <= 0 {
		points = 100
	}

	var schoolID *int = nil
	var companyID *int = nil

	if roleStr == "advisor" {
		var sID int
		err := config.DB.QueryRow("SELECT school_id FROM users WHERE id = ?", userIDInt).Scan(&sID)
		if err == nil && sID > 0 {
			schoolID = &sID
		}
	} else if roleStr == "company" {
		cID, err := getUserCompanyID(userIDInt)
		if err == nil && cID > 0 {
			companyID = &cID
		}
	}

	res, err := config.DB.Exec(
		`INSERT INTO assignments (title, description, due_date, points, creator_id, creator_role, school_id, company_id, student_id, job_posting_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Title, input.Description, dueDateVal, points, userIDInt, roleStr, schoolID, companyID, input.StudentID, input.JobPostingID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ไม่สามารถสร้างงานมอบหมายได้: " + err.Error()})
		return
	}

	id, _ := res.LastInsertId()

	c.JSON(http.StatusCreated, gin.H{
		"status":  201,
		"message": "สร้างงานที่มอบหมายสำเร็จ",
		"data": gin.H{
			"id":             id,
			"title":          input.Title,
			"description":    input.Description,
			"due_date":       dueDateVal,
			"points":         points,
			"creator_id":     userIDInt,
			"creator_role":   roleStr,
			"school_id":      schoolID,
			"company_id":     companyID,
			"student_id":     input.StudentID,
			"job_posting_id": input.JobPostingID,
		},
	})
}

// ========================================================
// [GET] ดึงงานมอบหมายทั้งหมด (Get All Assignments)
// ========================================================
func GetAllAssignmentsHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var query string
	var args []interface{}

	if roleStr == "admin" {
		query = "SELECT id, title, description, due_date, points, creator_id, creator_role, school_id, company_id, student_id, job_posting_id, created_at, updated_at FROM assignments"
	} else if roleStr == "advisor" {
		var sID int
		_ = config.DB.QueryRow("SELECT school_id FROM users WHERE id = ?", userIDInt).Scan(&sID)

		query = `SELECT id, title, description, due_date, points, creator_id, creator_role, school_id, company_id, student_id, job_posting_id, created_at, updated_at 
		         FROM assignments 
		         WHERE creator_id = ? OR school_id = ?`
		args = append(args, userIDInt, sID)
	} else if roleStr == "company" {
		cID, _ := getUserCompanyID(userIDInt)

		query = `SELECT id, title, description, due_date, points, creator_id, creator_role, school_id, company_id, student_id, job_posting_id, created_at, updated_at 
		         FROM assignments 
		         WHERE creator_id = ? 
		            OR company_id = ?
		            OR student_id IN (
		                SELECT student_id FROM internships WHERE company_id = ? AND status = 'active'
		            )
		            OR job_posting_id IN (
		                SELECT job_posting_id FROM internships WHERE company_id = ? AND status = 'active'
		            )`
		args = append(args, userIDInt, cID, cID, cID)
	} else { // student
		var sID int
		_ = config.DB.QueryRow("SELECT school_id FROM users WHERE id = ?", userIDInt).Scan(&sID)

		// Get company_id and job_posting_id where student has/had internships
		rowsInternships, _ := config.DB.Query("SELECT company_id, job_posting_id FROM internships WHERE student_id = ? AND status IN ('active', 'completed')", userIDInt)
		var companyIDs []interface{}
		var jobPostingIDs []interface{}
		companyIDs = append(companyIDs, 0) // default fallback
		jobPostingIDs = append(jobPostingIDs, 0) // default fallback
		if rowsInternships != nil {
			for rowsInternships.Next() {
				var cid, jpid int
				if err := rowsInternships.Scan(&cid, &jpid); err == nil {
					companyIDs = append(companyIDs, cid)
					jobPostingIDs = append(jobPostingIDs, jpid)
				}
			}
			rowsInternships.Close()
		}

		inCompanyClause := ""
		for i := range companyIDs {
			if i > 0 {
				inCompanyClause += ","
			}
			inCompanyClause += "?"
		}

		inJobClause := ""
		for i := range jobPostingIDs {
			if i > 0 {
				inJobClause += ","
			}
			inJobClause += "?"
		}

		query = fmt.Sprintf(
			`SELECT id, title, description, due_date, points, creator_id, creator_role, school_id, company_id, student_id, job_posting_id, created_at, updated_at 
			 FROM assignments 
			 WHERE (school_id = ? AND (student_id IS NULL OR student_id = ?))
			    OR (company_id IN (%s) AND (
			          (student_id IS NULL AND job_posting_id IS NULL)
			          OR student_id = ?
			          OR job_posting_id IN (%s)
			       ))`,
			inCompanyClause, inJobClause,
		)
		args = append(args, sID, userIDInt)
		args = append(args, companyIDs...)
		args = append(args, userIDInt)
		args = append(args, jobPostingIDs...)
	}

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ไม่สามารถดึงข้อมูลงานที่มอบหมายได้: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, points, creatorID int
		var title, description, creatorRole string
		var dueDate *time.Time
		var schoolID, companyID, studentID, jobPostingID sql.NullInt64
		var createdAt, updatedAt time.Time

		err := rows.Scan(&id, &title, &description, &dueDate, &points, &creatorID, &creatorRole, &schoolID, &companyID, &studentID, &jobPostingID, &createdAt, &updatedAt)
		if err != nil {
			continue
		}

		var schID interface{} = nil
		if schoolID.Valid {
			schID = schoolID.Int64
		}
		var compID interface{} = nil
		if companyID.Valid {
			compID = companyID.Int64
		}
		var studID interface{} = nil
		if studentID.Valid {
			studID = studentID.Int64
		}
		var jbID interface{} = nil
		if jobPostingID.Valid {
			jbID = jobPostingID.Int64
		}

		list = append(list, gin.H{
			"id":             id,
			"title":          title,
			"description":    description,
			"due_date":       dueDate,
			"points":         points,
			"creator_id":     creatorID,
			"creator_role":   creatorRole,
			"school_id":      schID,
			"company_id":     compID,
			"student_id":     studID,
			"job_posting_id": jbID,
			"created_at":     createdAt,
			"updated_at":     updatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status": 200,
		"data":   list,
	})
}

// ========================================================
// [POST] นักศึกษาส่งงาน (Submit Assignment Work)
// ========================================================
func CreateSubmissionHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	if roleStr != "student" {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "เฉพาะนักศึกษาเท่านั้นที่สามารถส่งงานได้"})
		return
	}

	var input struct {
		AssignmentID int    `json:"assignment_id" binding:"required"`
		Content      string `json:"content"`
		FileName     string `json:"file_name"`
		FilePath     string `json:"file_path"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	// Check if already submitted
	var existingID int
	err := config.DB.QueryRow(
		"SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?",
		input.AssignmentID, userIDInt,
	).Scan(&existingID)

	var res sql.Result
	var status string = "submitted"

	// Check if late
	var dueDate *time.Time
	_ = config.DB.QueryRow("SELECT due_date FROM assignments WHERE id = ?", input.AssignmentID).Scan(&dueDate)
	if dueDate != nil && time.Now().After(*dueDate) {
		status = "late"
	}

	if err == sql.ErrNoRows {
		res, err = config.DB.Exec(
			`INSERT INTO submissions (assignment_id, student_id, content, file_name, file_path, status, submitted_at)
			 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
			input.AssignmentID, userIDInt, input.Content, input.FileName, input.FilePath, status,
		)
	} else if err == nil {
		res, err = config.DB.Exec(
			`UPDATE submissions 
			 SET content = ?, file_name = ?, file_path = ?, status = ?, score = NULL, feedback = NULL, graded_at = NULL, submitted_at = NOW() 
			 WHERE id = ?`,
			input.Content, input.FileName, input.FilePath, status, existingID,
		)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ส่งงานไม่สำเร็จ: " + err.Error()})
		return
	}

	var id int64
	if existingID > 0 {
		id = int64(existingID)
	} else {
		id, _ = res.LastInsertId()
	}

	c.JSON(http.StatusCreated, gin.H{
		"status":  201,
		"message": "ส่งงานมอบหมายเรียบร้อยแล้ว",
		"data": gin.H{
			"id":            id,
			"assignment_id": input.AssignmentID,
			"student_id":    userIDInt,
			"content":       input.Content,
			"file_name":     input.FileName,
			"file_path":     input.FilePath,
			"status":        status,
			"submitted_at":  time.Now(),
		},
	})
}

// ========================================================
// [GET] ดึงข้อมูลส่งงานทั้งหมด (Get All Submissions)
// ========================================================
func GetAllSubmissionsHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var query string
	var args []interface{}

	if roleStr == "admin" {
		query = `SELECT s.id, s.assignment_id, s.student_id, COALESCE(s.content,''), COALESCE(s.file_name,''), COALESCE(s.file_path,''), s.status, s.score, COALESCE(s.feedback,''), s.submitted_at, s.graded_at 
		         FROM submissions s`
	} else if roleStr == "student" {
		query = `SELECT s.id, s.assignment_id, s.student_id, COALESCE(s.content,''), COALESCE(s.file_name,''), COALESCE(s.file_path,''), s.status, s.score, COALESCE(s.feedback,''), s.submitted_at, s.graded_at 
		         FROM submissions s 
		         WHERE s.student_id = ?`
		args = append(args, userIDInt)
	} else if roleStr == "advisor" {
		var sID int
		_ = config.DB.QueryRow("SELECT school_id FROM users WHERE id = ?", userIDInt).Scan(&sID)

		query = `SELECT s.id, s.assignment_id, s.student_id, COALESCE(s.content,''), COALESCE(s.file_name,''), COALESCE(s.file_path,''), s.status, s.score, COALESCE(s.feedback,''), s.submitted_at, s.graded_at 
		         FROM submissions s
		         JOIN assignments a ON s.assignment_id = a.id
		         WHERE a.school_id = ?`
		args = append(args, sID)
	} else if roleStr == "company" {
		cID, _ := getUserCompanyID(userIDInt)

		query = `SELECT s.id, s.assignment_id, s.student_id, COALESCE(s.content,''), COALESCE(s.file_name,''), COALESCE(s.file_path,''), s.status, s.score, COALESCE(s.feedback,''), s.submitted_at, s.graded_at 
		         FROM submissions s
		         JOIN assignments a ON s.assignment_id = a.id
		         WHERE a.company_id = ?
		            OR s.student_id IN (
		                SELECT student_id FROM internships WHERE company_id = ? AND status IN ('active', 'completed')
		            )`
		args = append(args, cID, cID)
	}

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ไม่สามารถดึงข้อมูลการส่งงานได้: " + err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, assignmentID, studentID int
		var content, fileName, filePath, status, feedback string
		var score sql.NullFloat64
		var submittedAt time.Time
		var gradedAt *time.Time

		err := rows.Scan(&id, &assignmentID, &studentID, &content, &fileName, &filePath, &status, &score, &feedback, &submittedAt, &gradedAt)
		if err != nil {
			continue
		}

		var scoreVal interface{} = nil
		if score.Valid {
			scoreVal = score.Float64
		}

		list = append(list, gin.H{
			"id":            id,
			"assignment_id": assignmentID,
			"student_id":    studentID,
			"content":       content,
			"file_name":     fileName,
			"file_path":     filePath,
			"status":        status,
			"score":         scoreVal,
			"feedback":      feedback,
			"submitted_at":  submittedAt,
			"graded_at":     gradedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status": 200,
		"data":   list,
	})
}

// ========================================================
// [PUT] ตรวจงานและให้คะแนน (Grade Submission)
// ========================================================
func GradeSubmissionHandler(c *gin.Context) {
	subID := c.Param("id")

	reqRole, _ := c.Get("role")
	roleStr := reqRole.(string)

	if roleStr != "advisor" && roleStr != "company" && roleStr != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "เฉพาะอาจารย์หรือพี่เลี้ยงเท่านั้นที่สามารถตรวจงานได้"})
		return
	}

	var input struct {
		Score    float64 `json:"score" binding:"required"`
		Feedback string  `json:"feedback"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ข้อมูลคะแนนไม่ถูกต้อง: " + err.Error()})
		return
	}

	submissionID, err := strconv.Atoi(subID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ID การส่งงานไม่ถูกต้อง"})
		return
	}

	// Update DB
	_, err = config.DB.Exec(
		"UPDATE submissions SET score = ?, feedback = ?, status = 'graded', graded_at = NOW() WHERE id = ?",
		input.Score, input.Feedback, submissionID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ตรวจงานไม่สำเร็จ: " + err.Error()})
		return
	}

	// Query updated submission back
	var assignmentID, studentID int
	var status, content, fileName, filePath, feedback string
	var score float64
	var submittedAt time.Time
	var gradedAt time.Time
	_ = config.DB.QueryRow(
		`SELECT assignment_id, student_id, COALESCE(content, ''), COALESCE(file_name, ''), COALESCE(file_path, ''), status, score, COALESCE(feedback, ''), submitted_at, graded_at 
		 FROM submissions 
		 WHERE id = ?`,
		submissionID,
	).Scan(&assignmentID, &studentID, &content, &fileName, &filePath, &status, &score, &feedback, &submittedAt, &gradedAt)

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ตรวจและบันทึกคะแนนงานสำเร็จ",
		"data": gin.H{
			"id":            submissionID,
			"assignment_id": assignmentID,
			"student_id":    studentID,
			"content":       content,
			"file_name":     fileName,
			"file_path":     filePath,
			"status":        status,
			"score":         score,
			"feedback":      feedback,
			"submitted_at":  submittedAt,
			"graded_at":     gradedAt,
		},
	})
}
