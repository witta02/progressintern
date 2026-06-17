package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
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
		log.Fatalf("❌ sql.Open failed: %v", err)
	}
	defer db.Close()

	email := "admin@gmail.com"
	realPassword := ";bT;bomN"
	hashed, err := bcrypt.GenerateFromPassword([]byte(realPassword), 10)
	if err != nil {
		log.Fatalf("❌ bcrypt.Generate failed: %v", err)
	}

	// Delete existing
	res, err := db.Exec("DELETE FROM users WHERE email = ?", email)
	if err != nil {
		log.Fatalf("❌ DELETE failed: %v", err)
	}
	delRows, _ := res.RowsAffected()
	fmt.Printf("Deleted %d existing admin rows.\n", delRows)

	// Insert
	res, err = db.Exec(`
		INSERT INTO users (name, email, password, role, status, school) 
		VALUES ('System Admin', ?, ?, 'admin', 'active', '-')`,
		email, string(hashed),
	)
	if err != nil {
		log.Fatalf("❌ INSERT failed: %v", err)
	}
	insRows, _ := res.RowsAffected()
	fmt.Printf("Inserted %d admin rows.\n", insRows)

	// Select all users
	rows, err := db.Query("SELECT id, name, email, role, status FROM users")
	if err != nil {
		log.Fatalf("❌ SELECT failed: %v", err)
	}
	defer rows.Close()

	fmt.Println("=== CURRENT USERS IN DATABASE ===")
	count := 0
	for rows.Next() {
		var id int
		var name, email, role, status string
		if err := rows.Scan(&id, &name, &email, &role, &status); err != nil {
			log.Fatalf("❌ Scan failed: %v", err)
		}
		fmt.Printf("ID: %d | Name: %s | Email: %s | Role: %s | Status: %s\n", id, name, email, role, status)
		count++
	}
	fmt.Printf("Total users: %d\n", count)
}
