package handlers

import (
	"database/sql"
	"fmt"
	"internship-backend/config"
	"math"
	"time"

	"github.com/gin-gonic/gin"
)

// Helper function to calculate distance using Haversine formula
func distance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000 // Earth radius in meters
	phi1 := lat1 * math.Pi / 180
	phi2 := lat2 * math.Pi / 180
	deltaPhi := (lat2 - lat1) * math.Pi / 180
	deltaLambda := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(deltaPhi/2)*math.Sin(deltaPhi/2) +
		math.Cos(phi1)*math.Cos(phi2)*
			math.Sin(deltaLambda/2)*math.Sin(deltaLambda/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c // in meters
}

// ========================================================
// [POST] นักศึกษาเช็คอินเข้างานประจำวัน
// ========================================================
func CheckInHandler(c *gin.Context) {
	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	if reqRole.(string) != "student" {
		c.JSON(403, gin.H{"status": 403, "error": "เฉพาะนักศึกษาเท่านั้นที่ลงเวลาเข้างานได้"})
		return
	}

	var input struct {
		InternshipID int     `json:"internship_id" binding:"required"`
		StudentID    int     `json:"student_id" binding:"required"`
		Latitude     float64 `json:"latitude"`
		Longitude    float64 `json:"longitude"`
		IsWFH        bool    `json:"is_wfh"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	if input.StudentID != reqUserID.(int) {
		c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ลงเวลาเข้างานแทนผู้อื่น"})
		return
	}

	var internshipExists int
	err := config.DB.QueryRow(
		"SELECT COUNT(*) FROM internships WHERE id = ? AND student_id = ? AND status = 'active'",
		input.InternshipID, input.StudentID,
	).Scan(&internshipExists)
	if err != nil || internshipExists == 0 {
		c.JSON(403, gin.H{"status": 403, "error": "ไม่พบข้อมูลการฝึกงานที่มีสถานะ Active ของคุณ"})
		return
	}

	// Check if already checked in today (in Bangkok timezone)
	var lastCheckIn time.Time
	err = config.DB.QueryRow(
		"SELECT check_in_time FROM attendances WHERE internship_id = ? AND student_id = ? ORDER BY check_in_time DESC LIMIT 1",
		input.InternshipID, input.StudentID,
	).Scan(&lastCheckIn)

	bangkok := time.FixedZone("Asia/Bangkok", 7*60*60)
	now := time.Now().In(bangkok)

	if err == nil {
		lastLocal := lastCheckIn.In(bangkok)
		if lastLocal.Format("2006-01-02") == now.Format("2006-01-02") {
			c.JSON(409, gin.H{"status": 409, "error": "วันนี้เช็คอินแล้ว"})
			return
		}
	}

	// Determine status: check against lated_time from job_postings
	status := "present"
	var latedTimeStr *string
	config.DB.QueryRow(
		`SELECT j.lated_time FROM internships i 
		 JOIN job_postings j ON i.job_posting_id = j.id 
		 WHERE i.id = ?`, input.InternshipID,
	).Scan(&latedTimeStr)

	// Fallback to "09:15:00" if lated_time is NULL
	targetLateTime := "09:15:00"
	if latedTimeStr != nil {
		targetLateTime = *latedTimeStr
	}

	var h, m, s int
	_, errScan := fmt.Sscanf(targetLateTime, "%d:%d:%d", &h, &m, &s)
	if errScan == nil {
		currentSeconds := now.Hour()*3600 + now.Minute()*60 + now.Second()
		lateSeconds := h*3600 + m*60 + s
		if currentSeconds > lateSeconds {
			status = "late"
		}
	}

	// GPS radius check (enforced strictly if NOT WFH)
	if !input.IsWFH {
		var compLat, compLng *float64
		var checkRadius *int
		err = config.DB.QueryRow(
			`SELECT c.latitude, c.longitude, c.check_radius 
			 FROM internships i 
			 JOIN companies c ON i.company_id = c.id 
			 WHERE i.id = ?`, input.InternshipID,
		).Scan(&compLat, &compLng, &checkRadius)
		
		if err != nil || compLat == nil || compLng == nil {
			c.JSON(400, gin.H{
				"status": 400,
				"error": "สถานประกอบการยังไม่ได้ตั้งค่าพิกัดตำแหน่งที่ตั้ง กรุณาแจ้งพี่เลี้ยงให้ปักหมุดพิกัดบนแผนที่ก่อนลงเวลาเข้างาน",
			})
			return
		}

		if input.Latitude == 0 && input.Longitude == 0 {
			c.JSON(400, gin.H{
				"status": 400,
				"error": "ไม่พบพิกัดตำแหน่งสำหรับยืนยันระยะเช็คอินของคุณ กรุณาเปิดใช้งานสิทธิ์ระบุตำแหน่ง GPS",
			})
			return
		}

		radius := 200
		if checkRadius != nil {
			radius = *checkRadius
		}
		dist := distance(input.Latitude, input.Longitude, *compLat, *compLng)
		if dist > float64(radius) {
			c.JSON(400, gin.H{
				"status": 400, 
				"error": fmt.Sprintf("คุณอยู่นอกพื้นที่เช็คอินที่บริษัทกำหนด (ระยะห่างปัจจุบัน %.0f เมตร เกินระยะ %d เมตร) ไม่สามารถเช็คอินได้", dist, radius),
			})
			return
		}
	}

	notes := ""
	if input.IsWFH {
		notes = "WFH"
	}

	_, err = config.DB.Exec(
		"INSERT INTO attendances (internship_id, student_id, check_in_time, latitude, longitude, status, notes, is_wfh) "+
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		input.InternshipID, input.StudentID, now, input.Latitude, input.Longitude, status, notes, input.IsWFH,
	)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "ลงเวลาเข้างานไม่สำเร็จ: " + err.Error()})
		return
	}

	_, _ = config.DB.Exec("UPDATE users SET online_status = 'online' WHERE id = ?", input.StudentID)

	msg := "เช็คอินเข้างานเรียบร้อย ขอให้เป็นวันที่ดี!"
	if status == "late" {
		msg = "เช็คอินเรียบร้อย (สาย)"
	}

	c.JSON(201, gin.H{"status": 201, "message": msg, "data": gin.H{"attendance_status": status}})
}

// ========================================================
// [PUT] นักศึกษาเช็คเอาท์เลิกงาน
// ========================================================
func CheckOutHandler(c *gin.Context) {
	var input struct {
		ID                 int      `json:"id"`
		InternshipID       int      `json:"internship_id" binding:"required"`
		StudentID          int      `json:"student_id" binding:"required"`
		Status             string   `json:"status"`
		VerificationStatus string   `json:"verification_status"`
		Latitude           *float64 `json:"latitude"`
		Longitude          *float64 `json:"longitude"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	bangkok := time.FixedZone("Asia/Bangkok", 7*60*60)
	now := time.Now().In(bangkok)

	reqRole, _ := c.Get("role")
	reqUserID, _ := c.Get("user_id")

	roleStr := reqRole.(string)
	userIDInt := reqUserID.(int)

	isVerificationRequest := input.VerificationStatus != "" || input.Status != ""

	if isVerificationRequest {
		isAuthorized := false
		if roleStr == "admin" {
			isAuthorized = true
		} else if roleStr == "company" {
			var iCompanyID int
			err := config.DB.QueryRow("SELECT company_id FROM internships WHERE id = ?", input.InternshipID).Scan(&iCompanyID)
			
			if err == nil {
				var userCompanyID sql.NullInt64
				_ = config.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", userIDInt).Scan(&userCompanyID)
				
				if userCompanyID.Valid && int(userCompanyID.Int64) == iCompanyID {
					isAuthorized = true
				} else {
					var dbUserID int
					_ = config.DB.QueryRow("SELECT user_id FROM companies WHERE id = ?", iCompanyID).Scan(&dbUserID)
					if dbUserID == userIDInt {
						isAuthorized = true
					}
				}
			}
		}

		if !isAuthorized {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ในการอนุมัติหรือแก้ไขสถานะการลงเวลานี้"})
			return
		}
	} else {
		if roleStr != "student" || input.StudentID != userIDInt {
			c.JSON(403, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ลงเวลาออกแทนผู้อื่น"})
			return
		}
	}

	var sql string
	var args []interface{}

	if input.ID > 0 {
		if input.VerificationStatus != "" {
			// Approval/Rejection by company or advisor
			sql = "UPDATE attendances SET verification_status = ?"
			args = append(args, input.VerificationStatus)
			if input.VerificationStatus == "rejected" {
				sql += ", status = 'absent'"
			}
			sql += " WHERE id = ?"
			args = append(args, input.ID)
		} else if input.Status != "" {
			// Manual status update
			sql = "UPDATE attendances SET status = ? WHERE id = ?"
			args = append(args, input.Status, input.ID)
		} else {
			// Student checkout
			sql = "UPDATE attendances SET check_out_time = IFNULL(check_out_time, ?), checkout_latitude = ?, checkout_longitude = ? WHERE id = ?"
			args = append(args, now, input.Latitude, input.Longitude, input.ID)
		}
	} else {
		// Find the active check-in ID or fallback to checking the date range in Bangkok timezone
		var activeID int
		errFind := config.DB.QueryRow(
			"SELECT id FROM attendances WHERE internship_id = ? AND student_id = ? ORDER BY check_in_time DESC LIMIT 1",
			input.InternshipID, input.StudentID,
		).Scan(&activeID)

		if errFind == nil {
			if input.VerificationStatus != "" {
				sql = "UPDATE attendances SET verification_status = ?"
				args = append(args, input.VerificationStatus)
				if input.VerificationStatus == "rejected" {
					sql += ", status = 'absent'"
				}
				sql += " WHERE id = ?"
				args = append(args, activeID)
			} else if input.Status != "" {
				sql = "UPDATE attendances SET status = ? WHERE id = ?"
				args = append(args, input.Status, activeID)
			} else {
				sql = "UPDATE attendances SET check_out_time = IFNULL(check_out_time, ?), checkout_latitude = ?, checkout_longitude = ? WHERE id = ?"
				args = append(args, now, input.Latitude, input.Longitude, activeID)
			}
		} else {
			// Absolute fallback if no rows at all (should not happen)
			if input.VerificationStatus != "" {
				sql = "UPDATE attendances SET verification_status = ?"
				args = append(args, input.VerificationStatus)
				if input.VerificationStatus == "rejected" {
					sql += ", status = 'absent'"
				}
				sql += " WHERE internship_id = ? AND student_id = ?"
				args = append(args, input.InternshipID, input.StudentID)
			} else if input.Status != "" {
				sql = "UPDATE attendances SET status = ? WHERE internship_id = ? AND student_id = ?"
				args = append(args, input.Status, input.InternshipID, input.StudentID)
			} else {
				sql = "UPDATE attendances SET check_out_time = IFNULL(check_out_time, ?), checkout_latitude = ?, checkout_longitude = ? WHERE internship_id = ? AND student_id = ?"
				args = append(args, now, input.Latitude, input.Longitude, input.InternshipID, input.StudentID)
			}
		}
	}

	result, err := config.DB.Exec(sql, args...)
	if err != nil {
		c.JSON(500, gin.H{"status": 500, "error": "อัปเดตการลงเวลาไม่สำเร็จ: " + err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(404, gin.H{"status": 404, "error": "ไม่พบรายการเช็คอินวันนี้ หรือเช็คเอาท์ไปแล้ว"})
		return
	}

	if !isVerificationRequest {
		_, _ = config.DB.Exec("UPDATE users SET online_status = 'offline' WHERE id = ?", input.StudentID)
	}

	c.JSON(200, gin.H{"status": 200, "message": "อัปเดตการลงเวลาเรียบร้อย!"})
}
