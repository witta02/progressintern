
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

	query := `CREATE TABLE IF NOT EXISTS chat_messages (
			id INT AUTO_INCREMENT PRIMARY KEY,
			sender_id INT NOT NULL,
			receiver_id INT NOT NULL,
			message TEXT NOT NULL,
			is_read BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
		
	_, err = db.Exec(query)
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
	} else {
		fmt.Println("SUCCESS")
	}
}

