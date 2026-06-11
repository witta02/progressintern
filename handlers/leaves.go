package handlers

import (
	"database/sql"
	"internship-backend/config"
	"internship-backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateLeaveHandler handles student leave submission
func CreateLeaveHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	if reqRole.(string) != "student" {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Status:  http.StatusForbidden,
			Message: "เฉพาะนักศึกษาเท่านั้นที่สามารถส่งคำขอลาได้",
		})
		return
	}

	var input models.CreateLeaveInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Status:  http.StatusBadRequest,
			Message: "ข้อมูลไม่ถูกต้อง",
			Error:   err.Error(),
		})
		return
	}

	if input.StudentID != reqUserID.(int) {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Status:  http.StatusForbidden,
			Message: "คุณไม่มีสิทธิ์ส่งคำขอลาแทนผู้อื่น",
		})
		return
	}

	var internshipExists int
	err := config.DB.QueryRow(
		"SELECT COUNT(*) FROM internships WHERE id = ? AND student_id = ? AND status = 'active'",
		input.InternshipID, input.StudentID,
	).Scan(&internshipExists)
	if err != nil || internshipExists == 0 {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Status:  http.StatusForbidden,
			Message: "ไม่พบข้อมูลการฝึกงานที่มีสถานะ Active ของคุณ",
		})
		return
	}

	_, err = config.DB.Exec(
		"INSERT INTO leave_requests (internship_id, student_id, leave_type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?, ?)",
		input.InternshipID, input.StudentID, input.LeaveType, input.StartDate, input.EndDate, input.Reason,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถส่งคำขอลาได้",
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Status:  http.StatusCreated,
		Message: "ส่งคำขอลาเรียบร้อยแล้ว",
	})
}

// GetAllLeavesHandler returns all leave requests (for admin/advisor/company)
func GetAllLeavesHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var rows *sql.Rows
	var err error

	if roleStr == "admin" {
		rows, err = config.DB.Query("SELECT id, internship_id, student_id, leave_type, start_date, end_date, reason, status, mentor_id, comment, created_at, updated_at, approved_at FROM leave_requests ORDER BY created_at DESC")
	} else if roleStr == "advisor" {
		var school string
		config.DB.QueryRow("SELECT COALESCE(school,'') FROM users WHERE id = ?", userIDInt).Scan(&school)

		rows, err = config.DB.Query(
			`SELECT l.id, l.internship_id, l.student_id, l.leave_type, l.start_date, l.end_date, l.reason, l.status, l.mentor_id, l.comment, l.created_at, l.updated_at, l.approved_at 
			 FROM leave_requests l
			 LEFT JOIN users u ON l.student_id = u.id
			 WHERE u.school = ? AND u.school <> ''
			 ORDER BY l.created_at DESC`,
			school,
		)
	} else if roleStr == "company" {
		rows, err = config.DB.Query(
			`SELECT l.id, l.internship_id, l.student_id, l.leave_type, l.start_date, l.end_date, l.reason, l.status, l.mentor_id, l.comment, l.created_at, l.updated_at, l.approved_at 
			 FROM leave_requests l
			 LEFT JOIN internships i ON l.internship_id = i.id
			 LEFT JOIN companies c ON i.company_id = c.id
			 WHERE c.user_id = ?
			 ORDER BY l.created_at DESC`,
			userIDInt,
		)
	} else { // student
		rows, err = config.DB.Query(
			`SELECT id, internship_id, student_id, leave_type, start_date, end_date, reason, status, mentor_id, comment, created_at, updated_at, approved_at 
			 FROM leave_requests 
			 WHERE student_id = ?
			 ORDER BY created_at DESC`,
			userIDInt,
		)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถดึงข้อมูลการลาได้",
			Error:   err.Error(),
		})
		return
	}
	defer rows.Close()

	leaves := []models.LeaveRequest{}
	for rows.Next() {
		var l models.LeaveRequest
		err := rows.Scan(&l.ID, &l.InternshipID, &l.StudentID, &l.LeaveType, &l.StartDate, &l.EndDate, &l.Reason, &l.Status, &l.MentorID, &l.Comment, &l.CreatedAt, &l.UpdatedAt, &l.ApprovedAt)
		if err != nil {
			continue
		}
		leaves = append(leaves, l)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Status:  http.StatusOK,
		Message: "ดึงข้อมูลการลาสำเร็จ",
		Data:    leaves,
	})
}

// UpdateLeaveStatusHandler handles leave approval/rejection
func UpdateLeaveStatusHandler(c *gin.Context) {
	id := c.Param("id")
	var input models.UpdateLeaveStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Status:  http.StatusBadRequest,
			Message: "ข้อมูลไม่ถูกต้อง",
			Error:   err.Error(),
		})
		return
	}

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	var sID, iID int
	err := config.DB.QueryRow("SELECT student_id, internship_id FROM leave_requests WHERE id = ?", id).Scan(&sID, &iID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Status:  http.StatusNotFound,
			Message: "ไม่พบคำขอลาที่ระบุ",
		})
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
		c.JSON(http.StatusForbidden, models.APIResponse{
			Status:  http.StatusForbidden,
			Message: "คุณไม่มีสิทธิ์ในการอนุมัติหรือปฏิเสธคำขอลานี้",
		})
		return
	}

	mentorID := userIDInt

	var approvedAt interface{}
	if input.Status == "approved" {
		approvedAt = time.Now()
	}

	_, err = config.DB.Exec(
		"UPDATE leave_requests SET status = ?, comment = ?, mentor_id = ?, approved_at = ? WHERE id = ?",
		input.Status, input.Comment, mentorID, approvedAt, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปเดตสถานะการลาได้",
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Status:  http.StatusOK,
		Message: "อัปเดตสถานะการลาเรียบร้อยแล้ว",
	})
}
