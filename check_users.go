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

	rows, err := db.Query("DESCRIBE users")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("=== USERS TABLE COLUMNS ===")
	for rows.Next() {
		var field, typ, null, key, extra string
		var defaultVal sql.NullString
		rows.Scan(&field, &typ, &null, &key, &defaultVal, &extra)
		fmt.Printf("Field: %s | Type: %s | Null: %s | Default: %v\n", field, typ, null, defaultVal.String)
	}
}
