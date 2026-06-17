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
		log.Fatalf("❌ sql.Open failed: %v", err)
	}
	defer db.Close()

	fmt.Println("Migrating attendances table to add checkout GPS columns...")

	// 1. Add checkout_latitude column
	var hasCheckoutLat bool
	err = db.QueryRow(`
		SELECT COUNT(*) FROM information_schema.columns 
		WHERE table_schema = ? AND table_name = 'attendances' AND column_name = 'checkout_latitude'
	`, os.Getenv("DB_NAME")).Scan(&hasCheckoutLat)

	if err != nil {
		log.Fatalf("❌ Check columns failed: %v", err)
	}

	if !hasCheckoutLat {
		_, err = db.Exec("ALTER TABLE attendances ADD COLUMN checkout_latitude double NULL")
		if err != nil {
			log.Fatalf("❌ ALTER TABLE checkout_latitude failed: %v", err)
		}
		fmt.Println("✅ Added checkout_latitude column!")
	} else {
		fmt.Println("ℹ️ checkout_latitude column already exists.")
	}

	// 2. Add checkout_longitude column
	var hasCheckoutLng bool
	err = db.QueryRow(`
		SELECT COUNT(*) FROM information_schema.columns 
		WHERE table_schema = ? AND table_name = 'attendances' AND column_name = 'checkout_longitude'
	`, os.Getenv("DB_NAME")).Scan(&hasCheckoutLng)

	if err != nil {
		log.Fatalf("❌ Check columns failed: %v", err)
	}

	if !hasCheckoutLng {
		_, err = db.Exec("ALTER TABLE attendances ADD COLUMN checkout_longitude double NULL")
		if err != nil {
			log.Fatalf("❌ ALTER TABLE checkout_longitude failed: %v", err)
		}
		fmt.Println("✅ Added checkout_longitude column!")
	} else {
		fmt.Println("ℹ️ checkout_longitude column already exists.")
	}

	fmt.Println("🎉 Database migration completed successfully!")
}
