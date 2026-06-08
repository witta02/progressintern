//go:build ignore
// +build ignore

// This is a standalone debug script. Run with: go run check_db.go
// It is excluded from the main build with the //go:build ignore tag.

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

	_, err = db.Exec("ALTER TABLE job_postings ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE")
	if err != nil {
		log.Fatalf("ALTER TABLE failed: %v", err)
	}
	fmt.Println("=== ALTER TABLE job_postings SUCCESS ===")

	rows, err := db.Query("DESCRIBE job_postings")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("=== JOB POSTINGS SCHEMA AFTER ALTER ===")
	for rows.Next() {
		var field, typ, null, key, extra string
		var defaultVal sql.NullString
		rows.Scan(&field, &typ, &null, &key, &defaultVal, &extra)
		fmt.Printf("Field: %s | Type: %s | Null: %s | Key: %s | Default: %s | Extra: %s\n", field, typ, null, key, defaultVal.String, extra)
	}

	rows2, err := db.Query("DESCRIBE attendances")
	if err != nil {
		log.Fatal(err)
	}
	defer rows2.Close()

	fmt.Println("\n=== ATTENDANCES SCHEMA ===")
	for rows2.Next() {
		var field, typ, null, key, extra string
		var defaultVal sql.NullString
		rows2.Scan(&field, &typ, &null, &key, &defaultVal, &extra)
		fmt.Printf("Field: %s | Type: %s | Null: %s | Key: %s | Default: %s | Extra: %s\n", field, typ, null, key, defaultVal.String, extra)
	}
}
