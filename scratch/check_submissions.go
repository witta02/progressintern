//go:build ignore

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
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")
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

	fmt.Println("=== SUBMISSIONS ===")
	rows, err := db.Query("SELECT id, assignment_id, student_id, file_path, file_name, status FROM submissions")
	if err != nil {
		log.Println("Error reading submissions:", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var id, assignmentID, studentID int
			var filePath, fileName, status sql.NullString
			if err := rows.Scan(&id, &assignmentID, &studentID, &filePath, &fileName, &status); err != nil {
				log.Fatal(err)
			}
			fmt.Printf("ID: %d | AssignmentID: %d | StudentID: %d | Path: %s | Name: %s | Status: %s\n",
				id, assignmentID, studentID, filePath.String, fileName.String, status.String)
		}
	}

	fmt.Println("\n=== USERS (RESUMES) ===")
	rows2, err := db.Query("SELECT id, name, email, role, password, resume_url FROM users")
	if err != nil {
		log.Println("Error reading users:", err)
	} else {
		defer rows2.Close()
		for rows2.Next() {
			var id int
			var name, email, role, password, resumeUrl sql.NullString
			if err := rows2.Scan(&id, &name, &email, &role, &password, &resumeUrl); err != nil {
				log.Fatal(err)
			}
			if resumeUrl.String != "" || role.String == "student" {
				fmt.Printf("ID: %d | Name: %s | Email: %s | Role: %s | Pass: %s | Resume: %s\n",
					id, name.String, email.String, role.String, password.String, resumeUrl.String)
			}
		}
	}

	fmt.Println("\n=== ENROLLMENT CODES ===")
	rows3, err := db.Query("SELECT id, code, role, is_active FROM enrollment_codes")
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var id int
			var code, role string
			var isActive bool
			rows3.Scan(&id, &code, &role, &isActive)
			fmt.Printf("ID: %d | Code: %s | Role: %s | IsActive: %v\n", id, code, role, isActive)
		}
	} else {
		log.Println("Error reading enrollment codes:", err)
	}
}
