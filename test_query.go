//go:build ignore
// +build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?tls=true",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

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
		ORDER BY last_message_time DESC, u.name ASC
	`
	rows, err := db.Query(query, 1, 1, 1, 1, 1, 1)
	if err != nil {
		log.Fatal("Query failed: ", err)
	}
	defer rows.Close()

	var id int
	var name, role, profileImg, onlineStatus, lastMsg string
	var lastMsgTime []byte
	var unreadCount int
	var count int

	for rows.Next() {
		err := rows.Scan(&id, &name, &role, &profileImg, &onlineStatus, &lastMsg, &lastMsgTime, &unreadCount)
		if err != nil {
			log.Println("Scan error:", err)
			continue
		}
		count++
	}
	fmt.Printf("Query successful. Successfully scanned %d rows.\n", count)
}
