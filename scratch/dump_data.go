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

	fmt.Println("=== USERS ===")
	rows, err := db.Query("SELECT id, name, email, role, school, status FROM users")
	if err != nil {
		log.Fatal(err)
	}
	for rows.Next() {
		var id int
		var name, email, role, school, status string
		rows.Scan(&id, &name, &email, &role, &school, &status)
		fmt.Printf("ID: %d | Name: %s | Email: %s | Role: %s | School: %s | Status: %s\n", id, name, email, role, school, status)
	}
	rows.Close()

	fmt.Println("\n=== INTERNSHIPS ===")
	rows, err = db.Query("SELECT id, student_id, company_id, job_posting_id, start_date, end_date, status FROM internships")
	if err != nil {
		log.Fatal(err)
	}
	for rows.Next() {
		var id, studentID, companyID, jobPostingID int
		var startDate, endDate, status string
		rows.Scan(&id, &studentID, &companyID, &jobPostingID, &startDate, &endDate, &status)
		fmt.Printf("ID: %d | StudentID: %d | CompanyID: %d | JobPostingID: %d | StartDate: %s | EndDate: %s | Status: %s\n", id, studentID, companyID, jobPostingID, startDate, endDate, status)
	}
	rows.Close()

	fmt.Println("\n=== LEAVE REQUESTS ===")
	rows, err = db.Query("SELECT id, internship_id, student_id, leave_type, start_date, end_date, reason, status, comment FROM leave_requests")
	if err != nil {
		log.Fatal(err)
	}
	for rows.Next() {
		var id, internshipID, studentID int
		var leaveType, startDate, endDate, reason, status string
		var comment sql.NullString
		rows.Scan(&id, &internshipID, &studentID, &leaveType, &startDate, &endDate, &reason, &status, &comment)
		fmt.Printf("ID: %d | InternshipID: %d | StudentID: %d | LeaveType: %s | StartDate: %s | EndDate: %s | Reason: %s | Status: %s | Comment: %s\n", id, internshipID, studentID, leaveType, startDate, endDate, reason, status, comment.String)
	}
	rows.Close()
}
