package handlers

import (
	"database/sql"
	"encoding/json"
	"internship-backend/config"
	"internship-backend/models"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// WebSocket Upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

// Client represents a connected WebSocket client
type Client struct {
	UserID int
	Conn   *websocket.Conn
	Send   chan []byte
}

// Hub manages active clients and routes messages
type Hub struct {
	Clients    map[int]*Client // UserID -> Client
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *models.ChatMessage
	Mutex      sync.RWMutex
}

var ChatHub = Hub{
	Clients:    make(map[int]*Client),
	Register:   make(chan *Client),
	Unregister: make(chan *Client),
	Broadcast:  make(chan *models.ChatMessage),
}

func init() {
	go ChatHub.Run()
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Mutex.Lock()
			// If already connected, close the old one
			if oldClient, ok := h.Clients[client.UserID]; ok {
				oldClient.Conn.Close()
			}
			h.Clients[client.UserID] = client
			h.Mutex.Unlock()
			log.Printf("[ChatHub] User %d connected\n", client.UserID)

		case client := <-h.Unregister:
			h.Mutex.Lock()
			if _, ok := h.Clients[client.UserID]; ok {
				delete(h.Clients, client.UserID)
				close(client.Send)
			}
			h.Mutex.Unlock()
			log.Printf("[ChatHub] User %d disconnected\n", client.UserID)

		case msg := <-h.Broadcast:
			// Save to database
			err := saveMessageToDB(msg)
			if err != nil {
				log.Println("[ChatHub] Failed to save message:", err)
				continue
			}

			// Send to receiver if online
			h.Mutex.RLock()
			receiverClient, ok := h.Clients[msg.ReceiverID]
			h.Mutex.RUnlock()

			if ok {
				msgBytes, _ := json.Marshal(msg)
				select {
				case receiverClient.Send <- msgBytes:
				default:
					close(receiverClient.Send)
					h.Mutex.Lock()
					delete(h.Clients, receiverClient.UserID)
					h.Mutex.Unlock()
				}
			}

			// Send back to sender to confirm it was processed
			h.Mutex.RLock()
			senderClient, ok := h.Clients[msg.SenderID]
			h.Mutex.RUnlock()

			if ok {
				msgBytes, _ := json.Marshal(msg)
				select {
				case senderClient.Send <- msgBytes:
				default:
					close(senderClient.Send)
					h.Mutex.Lock()
					delete(h.Clients, senderClient.UserID)
					h.Mutex.Unlock()
				}
			}
		}
	}
}

func saveMessageToDB(msg *models.ChatMessage) error {
	db := config.GetDB()
	query := `
		INSERT INTO chat_messages (sender_id, receiver_id, message, is_read, created_at)
		VALUES (?, ?, ?, ?, ?)
	`
	msg.CreatedAt = time.Now()
	res, err := db.Exec(query, msg.SenderID, msg.ReceiverID, msg.Message, msg.IsRead, msg.CreatedAt)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err == nil {
		msg.ID = int(id)
	}
	return nil
}

// ReadPump listens for incoming messages from the WebSocket connection
func (c *Client) ReadPump() {
	defer func() {
		ChatHub.Unregister <- c
		c.Conn.Close()
	}()
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[ChatHub] error: %v", err)
			}
			break
		}
		var chatMsg models.ChatMessage
		if err := json.Unmarshal(message, &chatMsg); err == nil {
			chatMsg.SenderID = c.UserID // Ensure the sender ID is correct
			ChatHub.Broadcast <- &chatMsg
		} else {
			log.Println("[ChatHub] Failed to unmarshal message:", err)
		}
	}
}

// WritePump sends messages from the Hub to the WebSocket connection
func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.Conn.WriteMessage(websocket.TextMessage, message)
		}
	}
}

// ServeWS handles WebSocket requests from the clients
func ServeWS(c *gin.Context) {
	// Authentication is handled via query parameter 'token' or we can extract user ID if already in auth middleware
	// Since WS cannot send custom headers easily in JS, we pass user ID via query or rely on middleware if cookie is used.
	// For simplicity, we get userId from query string. We should ideally validate a token here.
	userIdStr := c.Query("userId")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("[ChatHub] Upgrade error:", err)
		return
	}

	client := &Client{
		UserID: userId,
		Conn:   conn,
		Send:   make(chan []byte, 256),
	}

	ChatHub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}

// GetChatHistoryHandler retrieves message history between current user and another user
func GetChatHistoryHandler(c *gin.Context) {
	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr := c.Param("userId")
	otherUserID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	db := config.GetDB()
	query := `
		SELECT id, sender_id, receiver_id, message, is_read, created_at 
		FROM chat_messages 
		WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		ORDER BY created_at ASC
	`
	rows, err := db.Query(query, currentUserID, otherUserID, otherUserID, currentUserID)
	if err != nil {
		log.Println("GetChatHistory err:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve chat history"})
		return
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var msg models.ChatMessage
		var createdTime []byte // Handle time parsing
		err := rows.Scan(&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.Message, &msg.IsRead, &createdTime)
		if err != nil {
			log.Println("Row scan err:", err)
			continue
		}
		if len(createdTime) > 0 {
			msg.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", string(createdTime))
		}
		messages = append(messages, msg)
	}

	// Mark received messages as read
	go func() {
		db.Exec("UPDATE chat_messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ?", otherUserID, currentUserID)
	}()

	c.JSON(http.StatusOK, gin.H{
		"status":  http.StatusOK,
		"message": "Chat history retrieved successfully",
		"data":    messages,
	})
}

// GetChatContactsHandler retrieves a list of users the current user can chat with
func GetChatContactsHandler(c *gin.Context) {
	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	db := config.GetDB()

	// 1. Retrieve current user's role, class_group, and company_id to enforce chat rules
	var role, classGroup string
	var companyID sql.NullInt64
	errUser := db.QueryRow("SELECT role, COALESCE(class_group, ''), company_id FROM users WHERE id = ?", currentUserID).Scan(&role, &classGroup, &companyID)
	if errUser != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve user info"})
		return
	}

	compID := int64(0)
	if companyID.Valid {
		compID = companyID.Int64
	}

	// 2. Fetch contacts matching the criteria
	query := `
		SELECT 
			u.id, u.name, u.role, COALESCE(u.profile_image, ''), u.online_status,
			COALESCE(m.message, '') as last_message,
			COALESCE(m.created_at, '1970-01-01 00:00:00') as last_message_time,
			(SELECT COUNT(*) FROM chat_messages cm WHERE cm.sender_id = u.id AND cm.receiver_id = ? AND cm.is_read = FALSE) as unread_count
		FROM users u
		LEFT JOIN (
			SELECT t.message, t.created_at, t.other_id
			FROM (
				SELECT message, created_at, 
				CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_id,
				ROW_NUMBER() OVER (PARTITION BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END ORDER BY created_at DESC) as rn
				FROM chat_messages
				WHERE sender_id = ? OR receiver_id = ?
			) t
			WHERE t.rn = 1
		) m ON u.id = m.other_id
		WHERE u.id != ? AND u.status = 'active'
		AND (
			( ? != '' AND u.class_group = ? ) OR 
			( ? != 0 AND u.company_id = ? ) OR
			( ? = 'admin' ) OR
			( ? = 'advisor' AND u.advisor_id = ? ) OR
			( ? = 'student' AND u.id = (SELECT advisor_id FROM users WHERE id = ?) )
		)
		ORDER BY last_message_time DESC, u.name ASC
	`
	rows, err := db.Query(query, 
		currentUserID, currentUserID, currentUserID, currentUserID, currentUserID, 
		currentUserID, // u.id != ?
		classGroup, classGroup, // u.class_group
		compID, compID, // u.company_id
		role, // admin
		role, currentUserID, // advisor
		role, currentUserID, // student
	)
	if err != nil {
		log.Println("GetChatContacts err:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve chat contacts"})
		return
	}
	defer rows.Close()

	var contacts []models.ChatContact
	for rows.Next() {
		var contact models.ChatContact
		var lastMsgTime []byte
		err := rows.Scan(
			&contact.UserID, &contact.Name, &contact.Role, &contact.ProfileImage, 
			&contact.OnlineStatus, &contact.LastMessage, &lastMsgTime, &contact.UnreadCount,
		)
		if err != nil {
			log.Println("Contact row scan err:", err)
			continue
		}
		if len(lastMsgTime) > 0 {
			contact.LastMessageTime, _ = time.Parse("2006-01-02 15:04:05", string(lastMsgTime))
		}
		contacts = append(contacts, contact)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  http.StatusOK,
		"message": "Chat contacts retrieved successfully",
		"data":    contacts,
	})
}
