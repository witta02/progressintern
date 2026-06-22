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

	result, err := config.DB.Exec(
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

	id, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, models.APIResponse{
		Status:  http.StatusCreated,
		Message: "ส่งคำขอลาเรียบร้อยแล้ว",
		Data: gin.H{
			"id":            id,
			"internship_id": input.InternshipID,
			"student_id":    input.StudentID,
			"leave_type":    input.LeaveType,
			"start_date":    input.StartDate,
			"end_date":      input.EndDate,
			"reason":        input.Reason,
			"status":        "pending",
		},
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
	var leaveType, startDate, endDate, reason string
	err := config.DB.QueryRow(
		"SELECT student_id, internship_id, leave_type, start_date, end_date, reason FROM leave_requests WHERE id = ?",
		id,
	).Scan(&sID, &iID, &leaveType, &startDate, &endDate, &reason)
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
		Data: gin.H{
			"id":            id,
			"internship_id": iID,
			"student_id":    sID,
			"leave_type":    leaveType,
			"start_date":    startDate,
			"end_date":      endDate,
			"reason":        reason,
			"status":        input.Status,
			"mentor_id":     mentorID,
			"comment":       input.Comment,
			"approved_at":   approvedAt,
		},
	})
}

// ========================================================
// [PUT] นักศึกษาแก้ไขคำขอลา
// ========================================================
func UpdateLeaveHandler(c *gin.Context) {
	leaveID := c.Param("id")
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	if reqRole.(string) != "student" {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Status:  http.StatusForbidden,
			Message: "เฉพาะนักศึกษาเท่านั้นที่สามารถแก้ไขคำขอลาได้",
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
			Message: "คุณไม่มีสิทธิ์แก้ไขคำขอลาของผู้อื่น",
		})
		return
	}

	// Verify ownership and that status is not approved
	var currentStatus string
	err := config.DB.QueryRow(
		"SELECT status FROM leave_requests WHERE id = ? AND student_id = ?",
		leaveID, reqUserID.(int),
	).Scan(&currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, models.APIResponse{
				Status:  http.StatusNotFound,
				Message: "ไม่พบคำขอลาที่ระบุหรือคุณไม่มีสิทธิ์แก้ไข",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ตรวจสอบข้อมูลการลาไม่สำเร็จ",
			Error:   err.Error(),
		})
		return
	}

	if currentStatus == "approved" {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Status:  http.StatusForbidden,
			Message: "ไม่สามารถแก้ไขคำขอลาที่ได้รับการอนุมัติแล้วได้",
		})
		return
	}

	// Update leave request
	_, err = config.DB.Exec(
		"UPDATE leave_requests SET leave_type = ?, start_date = ?, end_date = ?, reason = ?, updated_at = NOW() WHERE id = ?",
		input.LeaveType, input.StartDate, input.EndDate, input.Reason, leaveID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "แก้ไขคำขอลาไม่สำเร็จ",
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Status:  http.StatusOK,
		Message: "แก้ไขคำขอลาสำเร็จ",
		Data: gin.H{
			"id":            leaveID,
			"internship_id": input.InternshipID,
			"student_id":    input.StudentID,
			"leave_type":    input.LeaveType,
			"start_date":    input.StartDate,
			"end_date":      input.EndDate,
			"reason":        input.Reason,
			"status":        currentStatus,
		},
	})
}

// ========================================================
// [DELETE] นักศึกษาลบคำขอลา
// ========================================================
func DeleteLeaveHandler(c *gin.Context) {
	leaveID := c.Param("id")
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	if reqRole.(string) != "student" {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Status:  http.StatusForbidden,
			Message: "เฉพาะนักศึกษาเท่านั้นที่สามารถลบคำขอลาได้",
		})
		return
	}

	// Verify ownership and status
	var currentStatus string
	err := config.DB.QueryRow(
		"SELECT status FROM leave_requests WHERE id = ? AND student_id = ?",
		leaveID, reqUserID.(int),
	).Scan(&currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, models.APIResponse{
				Status:  http.StatusNotFound,
				Message: "ไม่พบคำขอลาที่ระบุหรือคุณไม่มีสิทธิ์ลบ",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ตรวจสอบข้อมูลการลาไม่สำเร็จ",
			Error:   err.Error(),
		})
		return
	}

	if currentStatus == "approved" {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Status:  http.StatusForbidden,
			Message: "ไม่สามารถลบคำขอลาที่ได้รับการอนุมัติแล้วได้",
		})
		return
	}

	// Delete leave request
	_, err = config.DB.Exec("DELETE FROM leave_requests WHERE id = ?", leaveID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ลบคำขอลาไม่สำเร็จ",
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Status:  http.StatusOK,
		Message: "ลบคำขอลาสำเร็จ",
	})
}
