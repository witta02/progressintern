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

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?tls=true&timeout=10s&readTimeout=10s&writeTimeout=10s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)
	fmt.Printf("Connecting to TiDB Cloud at %s...\n", os.Getenv("DB_HOST"))

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("❌ Open failed: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatalf("❌ Ping failed: %v", err)
	}
	fmt.Println("💖 Connected to database successfully!")

	// 1. Create schools table
	schoolsSQL := `
	CREATE TABLE IF NOT EXISTS schools (
		id INT AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(255) UNIQUE NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`

	fmt.Println("Creating schools table...")
	if _, err = db.Exec(schoolsSQL); err != nil {
		log.Fatalf("❌ Failed to create schools table: %v", err)
	}
	fmt.Println("✅ schools table ready!")

	// 2. Create enrollment_codes table
	codesSQL := `
	CREATE TABLE IF NOT EXISTS enrollment_codes (
		id INT AUTO_INCREMENT PRIMARY KEY,
		school_id INT NULL,
		role ENUM('student', 'advisor', 'company') NOT NULL,
		code VARCHAR(100) UNIQUE NOT NULL,
		max_uses INT NULL,
		used_count INT DEFAULT 0,
		expires_at TIMESTAMP NULL,
		is_active BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`

	fmt.Println("Creating enrollment_codes table...")
	if _, err = db.Exec(codesSQL); err != nil {
		log.Fatalf("❌ Failed to create enrollment_codes table: %v", err)
	}
	fmt.Println("✅ enrollment_codes table ready!")

	// 3. Alter users table to add school_id column and foreign key if it does not exist
	var hasSchoolID bool
	err = db.QueryRow(`
		SELECT COUNT(*) FROM information_schema.columns 
		WHERE table_schema = ? AND table_name = 'users' AND column_name = 'school_id'
	`, os.Getenv("DB_NAME")).Scan(&hasSchoolID)

	if err != nil {
		log.Fatalf("❌ Failed to query columns: %v", err)
	}

	if !hasSchoolID {
		fmt.Println("Adding school_id column to users table...")
		alterSQL := `
		ALTER TABLE users 
		ADD COLUMN school_id INT NULL,
		ADD CONSTRAINT fk_users_school_id FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;`
		if _, err = db.Exec(alterSQL); err != nil {
			log.Fatalf("❌ Failed to alter users table: %v", err)
		}
		fmt.Println("✅ Added school_id column and foreign key to users table!")
	} else {
		fmt.Println("ℹ️ school_id column already exists in users table.")
	}

	// 4. Seed initial data
	fmt.Println("Seeding default schools and enrollment codes...")

	// Seed Bangkok University
	var buID int64
	err = db.QueryRow("SELECT id FROM schools WHERE name = 'Bangkok University'").Scan(&buID)
	if err == sql.ErrNoRows {
		res, err := db.Exec("INSERT INTO schools (name) VALUES ('Bangkok University')")
		if err != nil {
			log.Fatalf("❌ Failed to seed BU: %v", err)
		}
		buID, _ = res.LastInsertId()
		fmt.Printf("✅ Seeded Bangkok University with ID: %d\n", buID)
	} else if err != nil {
		log.Fatalf("❌ BU check query failed: %v", err)
	}

	// Seed Chulalongkorn University
	var cuID int64
	err = db.QueryRow("SELECT id FROM schools WHERE name = 'Chulalongkorn University'").Scan(&cuID)
	if err == sql.ErrNoRows {
		res, err := db.Exec("INSERT INTO schools (name) VALUES ('Chulalongkorn University')")
		if err != nil {
			log.Fatalf("❌ Failed to seed CU: %v", err)
		}
		cuID, _ = res.LastInsertId()
		fmt.Printf("✅ Seeded Chulalongkorn University with ID: %d\n", cuID)
	} else if err != nil {
		log.Fatalf("❌ CU check query failed: %v", err)
	}

	// Seed Enrollment Codes
	seedCodes := []struct {
		schoolID *int64
		role     string
		code     string
		maxUses  interface{}
	}{
		// Bangkok University Codes
		{&buID, "student", "BU-STU-2026", nil},
		{&buID, "advisor", "BU-ADV-2026", 5},
		// Chulalongkorn University Codes
		{&cuID, "student", "CU-STU-2026", nil},
		{&cuID, "advisor", "CU-ADV-2026", 5},
		// Global/Company Codes
		{nil, "company", "COMP-INV-2026", 10},
	}

	for _, sc := range seedCodes {
		var exists bool
		err = db.QueryRow("SELECT COUNT(*) FROM enrollment_codes WHERE code = ?", sc.code).Scan(&exists)
		if err != nil {
			log.Fatalf("❌ Code check failed: %v", err)
		}
		if !exists {
			var schoolVal interface{}
			if sc.schoolID != nil {
				schoolVal = *sc.schoolID
			} else {
				schoolVal = nil
			}

			_, err = db.Exec(
				"INSERT INTO enrollment_codes (school_id, role, code, max_uses) VALUES (?, ?, ?, ?)",
				schoolVal, sc.role, sc.code, sc.maxUses,
			)
			if err != nil {
				log.Fatalf("❌ Failed to insert code %s: %v", sc.code, err)
			}
			fmt.Printf("✅ Seeded code: %s (role: %s)\n", sc.code, sc.role)
		} else {
			fmt.Printf("ℹ️ Code %s already exists, skipping.\n", sc.code)
		}
	}

	fmt.Println("🎉 Database migration and seeding completed successfully!")
}
