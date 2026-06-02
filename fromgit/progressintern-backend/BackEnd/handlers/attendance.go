package handlers

import (
	"database/sql"
	"time"

	"internship-backend/config"
	"internship-backend/models"

	"github.com/gin-gonic/gin"
)

func GetAttendancesHandler(c *gin.Context) {
	rows, err := config.DB.Query(
		"SELECT id, internship_id, student_id, check_in_time, check_out_time, latitude, longitude, status, created_at FROM attendances ORDER BY id",
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to load attendances"})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, internshipID, studentID int
		var checkInTime, checkOutTime sql.NullTime
		var latitude, longitude sql.NullFloat64
		var status string
		var createdAt time.Time
		if err := rows.Scan(&id, &internshipID, &studentID, &checkInTime, &checkOutTime, &latitude, &longitude, &status, &createdAt); err != nil {
			c.JSON(500, gin.H{"error": "failed to read attendances"})
			return
		}
		list = append(list, attendanceJSON(id, internshipID, studentID, checkInTime, checkOutTime, latitude, longitude, status, createdAt))
	}

	c.JSON(200, list)
}

func CheckInHandler(c *gin.Context) {
	var input models.AttendanceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid attendance data"})
		return
	}

	result, err := config.DB.Exec(
		"INSERT INTO attendances (internship_id, student_id, check_in_time, latitude, longitude, status) VALUES (?, ?, NOW(), ?, ?, 'present')",
		input.InternshipID, input.StudentID, input.Latitude, input.Longitude,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to check in"})
		return
	}

	id, _ := result.LastInsertId()
	now := time.Now()
	c.JSON(201, gin.H{
		"id":             id,
		"internship_id":  input.InternshipID,
		"student_id":     input.StudentID,
		"check_in_time":  now,
		"check_out_time": nil,
		"latitude":       input.Latitude,
		"longitude":      input.Longitude,
		"status":         "present",
		"created_at":     now,
	})
}

func CheckOutHandler(c *gin.Context) {
	var input models.AttendanceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid attendance data"})
		return
	}

	_, err := config.DB.Exec(
		"UPDATE attendances SET check_out_time = NOW() WHERE internship_id = ? AND student_id = ? AND DATE(check_in_time) = CURDATE()",
		input.InternshipID, input.StudentID,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to check out"})
		return
	}

	c.JSON(200, gin.H{
		"internship_id":  input.InternshipID,
		"student_id":     input.StudentID,
		"check_out_time": time.Now(),
		"status":         "present",
	})
}

func attendanceJSON(id, internshipID, studentID int, checkInTime, checkOutTime sql.NullTime, latitude, longitude sql.NullFloat64, status string, createdAt time.Time) gin.H {
	return gin.H{
		"id":             id,
		"internship_id":  internshipID,
		"student_id":     studentID,
		"check_in_time":  nullTime(checkInTime),
		"check_out_time": nullTime(checkOutTime),
		"latitude":       nullFloat(latitude),
		"longitude":      nullFloat(longitude),
		"status":         status,
		"created_at":     createdAt,
	}
}

func nullTime(value sql.NullTime) any {
	if value.Valid {
		return value.Time
	}
	return nil
}

func nullFloat(value sql.NullFloat64) any {
	if value.Valid {
		return value.Float64
	}
	return nil
}
