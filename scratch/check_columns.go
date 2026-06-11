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

	rows, err := db.Query("SHOW COLUMNS FROM audit_logs")
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	defer rows.Close()

	fmt.Println("=== COLUMNS FOR audit_logs ===")
	for rows.Next() {
		var field, typ, null, key, extra string
		var defaultVal sql.NullString
		rows.Scan(&field, &typ, &null, &key, &defaultVal, &extra)
		fmt.Printf("Field: %s, Type: %s, Null: %s, Key: %s, Default: %s, Extra: %s\n", field, typ, null, key, defaultVal.String, extra)
	}
}
