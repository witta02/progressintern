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

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?tls=true&timeout=5s&readTimeout=5s&writeTimeout=5s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)
	fmt.Printf("Connecting to %s...\n", os.Getenv("DB_HOST"))

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		log.Fatalf("Ping failed: %v", err)
	}

	// 1. Create audit_logs table (with user_id NULLable)
	auditLogsSQL := `
	CREATE TABLE IF NOT EXISTS audit_logs (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INT NULL,
		action VARCHAR(100) NOT NULL,
		entity_type VARCHAR(50),
		entity_id INT,
		old_value JSON,
		new_value JSON,
		ip_address VARCHAR(50),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
		INDEX idx_user_id (user_id),
		INDEX idx_created_at (created_at),
		INDEX idx_entity (entity_type, entity_id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`

	fmt.Println("Creating audit_logs table...")
	_, err = db.Exec(auditLogsSQL)
	if err != nil {
		log.Fatalf("Failed to create audit_logs: %v", err)
	}
	fmt.Println("✅ audit_logs table created successfully!")

	// 2. Create notifications table
	notificationsSQL := `
	CREATE TABLE IF NOT EXISTS notifications (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INT NOT NULL,
		type VARCHAR(50),
		title VARCHAR(255) NOT NULL,
		message LONGTEXT NOT NULL,
		related_entity_type VARCHAR(50),
		related_entity_id INT,
		is_read BOOLEAN DEFAULT FALSE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		read_at DATETIME,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		INDEX idx_user_id (user_id),
		INDEX idx_is_read (is_read),
		INDEX idx_created_at (created_at)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`

	fmt.Println("Creating notifications table...")
	_, err = db.Exec(notificationsSQL)
	if err != nil {
		log.Fatalf("Failed to create notifications: %v", err)
	}
	fmt.Println("✅ notifications table created successfully!")

	// 3. Create file_uploads table
	fileUploadsSQL := `
	CREATE TABLE IF NOT EXISTS file_uploads (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INT NOT NULL,
		file_path VARCHAR(500) NOT NULL,
		file_name VARCHAR(255) NOT NULL,
		file_type VARCHAR(50),
		file_size INT,
		upload_type ENUM('resume', 'certificate', 'logbook_attachment', 'company_doc') DEFAULT 'resume',
		related_entity_type VARCHAR(50),
		related_entity_id INT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		INDEX idx_user_id (user_id),
		INDEX idx_upload_type (upload_type)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`

	fmt.Println("Creating file_uploads table...")
	_, err = db.Exec(fileUploadsSQL)
	if err != nil {
		log.Fatalf("Failed to create file_uploads: %v", err)
	}
	fmt.Println("✅ file_uploads table created successfully!")
}
