package handlers

import (
	"internship-backend/config"
	"internship-backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateLeaveHandler handles student leave submission
func CreateLeaveHandler(c *gin.Context) {
	var input models.CreateLeaveInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Status:  http.StatusBadRequest,
			Message: "ข้อมูลไม่ถูกต้อง",
			Error:   err.Error(),
		})
		return
	}

	_, err := config.DB.Exec(
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
	rows, err := config.DB.Query("SELECT id, internship_id, student_id, leave_type, start_date, end_date, reason, status, mentor_id, comment, created_at, updated_at, approved_at FROM leave_requests ORDER BY created_at DESC")
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

	mentorID, _ := c.Get("user_id")

	var approvedAt interface{}
	if input.Status == "approved" {
		approvedAt = time.Now()
	}

	_, err := config.DB.Exec(
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
