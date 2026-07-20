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

	// Query tables
	rows, err := db.Query("SHOW TABLES")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var table string
		rows.Scan(&table)
		tables = append(tables, table)
	}

	for _, table := range tables {
		// Describe table to find varchar/text columns
		cols, err := db.Query(fmt.Sprintf("DESCRIBE %s", table))
		if err != nil {
			continue
		}
		var textCols []string
		for cols.Next() {
			var field, typ, null, key, extra string
			var defaultVal sql.NullString
			cols.Scan(&field, &typ, &null, &key, &defaultVal, &extra)
			if typ == "varchar(500)" || typ == "varchar(255)" || typ == "text" || typ == "varchar(100)" {
				textCols = append(textCols, field)
			}
		}
		cols.Close()

		for _, col := range textCols {
			query := fmt.Sprintf("SELECT id, %s FROM %s WHERE %s LIKE '%%unnamed%%'", col, table, col)
			records, err := db.Query(query)
			if err != nil {
				continue
			}
			for records.Next() {
				var id int
				var val string
				records.Scan(&id, &val)
				fmt.Printf("Found in Table: %s | Column: %s | ID: %d | Value: %s\n", table, col, id, val)
			}
			records.Close()
		}
	}
}
