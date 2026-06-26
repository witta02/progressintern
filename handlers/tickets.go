package handlers

import (
	"database/sql"
	"internship-backend/config"
	"internship-backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateTicketHandler creates a new ticket
func CreateTicketHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDInt := userID.(int)

	var input models.CreateTicketInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	result, err := config.DB.Exec(
		"INSERT INTO tickets (user_id, title, description, status) VALUES (?, ?, ?, 'open')",
		userIDInt, input.Title, input.Description,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "สร้างตั๋วช่วยเหลือล้มเหลว: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{
		"status":  201,
		"message": "สร้างตั๋วช่วยเหลือสำเร็จ",
		"data": gin.H{
			"id":          id,
			"title":       input.Title,
			"description": input.Description,
			"status":      "open",
			"created_at":  time.Now(),
		},
	})
}

// GetAllTicketsHandler gets tickets
func GetAllTicketsHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDInt := userID.(int)
	role, _ := c.Get("role")
	roleStr := role.(string)

	var rows *sql.Rows
	var err error

	if roleStr == "admin" {
		// Admin gets all tickets
		rows, err = config.DB.Query(`
			SELECT t.id, t.user_id, u.name as user_name, u.role as user_role, t.title, t.description, t.status, t.created_at, t.updated_at
			FROM tickets t
			JOIN users u ON t.user_id = u.id
			ORDER BY t.created_at DESC
		`)
	} else {
		// Users get only their own tickets
		rows, err = config.DB.Query(`
			SELECT t.id, t.user_id, u.name as user_name, u.role as user_role, t.title, t.description, t.status, t.created_at, t.updated_at
			FROM tickets t
			JOIN users u ON t.user_id = u.id
			WHERE t.user_id = ?
			ORDER BY t.created_at DESC
		`, userIDInt)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ดึงข้อมูลตั๋วช่วยเหลือล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var tickets []models.Ticket
	for rows.Next() {
		var t models.Ticket
		err := rows.Scan(&t.ID, &t.UserID, &t.UserName, &t.UserRole, &t.Title, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "การดึงข้อมูลตั๋วช่วยเหลือผิดพลาด: " + err.Error()})
			return
		}
		tickets = append(tickets, t)
	}

	if tickets == nil {
		tickets = []models.Ticket{}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ดึงข้อมูลตั๋วช่วยเหลือสำเร็จ",
		"data":    tickets,
	})
}

// GetTicketByIDHandler gets details of a ticket along with replies
func GetTicketByIDHandler(c *gin.Context) {
	ticketID := c.Param("id")
	userID, _ := c.Get("user_id")
	userIDInt := userID.(int)
	role, _ := c.Get("role")
	roleStr := role.(string)

	var t models.Ticket
	err := config.DB.QueryRow(`
		SELECT t.id, t.user_id, u.name as user_name, u.role as user_role, t.title, t.description, t.status, t.created_at, t.updated_at
		FROM tickets t
		JOIN users u ON t.user_id = u.id
		WHERE t.id = ?
	`, ticketID).Scan(&t.ID, &t.UserID, &t.UserName, &t.UserRole, &t.Title, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"status": 404, "error": "ไม่พบตั๋วช่วยเหลือนี้"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ข้อผิดพลาดฐานข้อมูล: " + err.Error()})
		return
	}

	// Verify permissions: admin can read all, others can read only their own
	if roleStr != "admin" && t.UserID != userIDInt {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ดูตั๋วช่วยเหลือของผู้อื่น"})
		return
	}

	// Fetch replies
	rows, err := config.DB.Query(`
		SELECT r.id, r.ticket_id, r.user_id, u.name as user_name, u.role as user_role, r.message, r.created_at
		FROM ticket_replies r
		JOIN users u ON r.user_id = u.id
		WHERE r.ticket_id = ?
		ORDER BY r.created_at ASC
	`, ticketID)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ดึงข้อมูลคำตอบล้มเหลว: " + err.Error()})
		return
	}
	defer rows.Close()

	var replies []models.TicketReply
	for rows.Next() {
		var r models.TicketReply
		err := rows.Scan(&r.ID, &r.TicketID, &r.UserID, &r.UserName, &r.UserRole, &r.Message, &r.CreatedAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ข้อผิดพลาดการดึงข้อมูลคำตอบ: " + err.Error()})
			return
		}
		replies = append(replies, r)
	}

	if replies == nil {
		replies = []models.TicketReply{}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ดึงข้อมูลตั๋วช่วยเหลือสำเร็จ",
		"data": gin.H{
			"ticket":  t,
			"replies": replies,
		},
	})
}

// ReplyTicketHandler adds a reply to a ticket
func ReplyTicketHandler(c *gin.Context) {
	ticketID := c.Param("id")
	userID, _ := c.Get("user_id")
	userIDInt := userID.(int)
	role, _ := c.Get("role")
	roleStr := role.(string)

	var tUserID int
	var tStatus string
	err := config.DB.QueryRow("SELECT user_id, status FROM tickets WHERE id = ?", ticketID).Scan(&tUserID, &tStatus)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"status": 404, "error": "ไม่พบตั๋วช่วยเหลือนี้"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ข้อผิดพลาดฐานข้อมูล: " + err.Error()})
		return
	}

	// Perms: admin or owner
	if roleStr != "admin" && tUserID != userIDInt {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ตอบกลับตั๋วช่วยเหลือของผู้อื่น"})
		return
	}

	var input models.CreateTicketReplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "กรุณาระบุข้อความตอบกลับ"})
		return
	}

	// Insert reply
	_, err = config.DB.Exec(
		"INSERT INTO ticket_replies (ticket_id, user_id, message) VALUES (?, ?, ?)",
		ticketID, userIDInt, input.Message,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "การตอบกลับตั๋วช่วยเหลือล้มเหลว: " + err.Error()})
		return
	}

	// Automatically update ticket updated_at and reopen if closed
	newStatus := tStatus
	if roleStr != "admin" && tStatus == "resolved" {
		newStatus = "open" // reopen if user replies to resolved ticket
	}
	_, _ = config.DB.Exec("UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newStatus, ticketID)

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ตอบกลับตั๋วช่วยเหลือสำเร็จ",
	})
}

// UpdateTicketStatusHandler updates a ticket's status
func UpdateTicketStatusHandler(c *gin.Context) {
	ticketID := c.Param("id")
	userID, _ := c.Get("user_id")
	userIDInt := userID.(int)
	role, _ := c.Get("role")
	roleStr := role.(string)

	var tUserID int
	err := config.DB.QueryRow("SELECT user_id FROM tickets WHERE id = ?", ticketID).Scan(&tUserID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"status": 404, "error": "ไม่พบตั๋วช่วยเหลือนี้"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ข้อผิดพลาดฐานข้อมูล: " + err.Error()})
		return
	}

	// Perms: Admin can change to any status. Creator can close/resolve their own ticket.
	if roleStr != "admin" && tUserID != userIDInt {
		c.JSON(http.StatusForbidden, gin.H{"status": 403, "error": "คุณไม่มีสิทธิ์ปรับปรุงสถานะของตั๋วช่วยเหลือนี้"})
		return
	}

	var input struct {
		Status string `json:"status" binding:"required,oneof=open resolved closed"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 400, "error": "สถานะไม่ถูกต้อง"})
		return
	}

	_, err = config.DB.Exec("UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", input.Status, ticketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": 500, "error": "ปรับปรุงสถานะตั๋วช่วยเหลือล้มเหลว: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  200,
		"message": "ปรับปรุงสถานะตั๋วช่วยเหลือสำเร็จ",
	})
}
