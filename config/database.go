package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

// InitDatabase เชื่อมต่อกับ TiDB Cloud
func InitDatabase() error {
	var err error

	// ดึง environment variables
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")

	if dbHost == "" || dbPort == "" {
		return fmt.Errorf("DB_HOST หรือ DB_PORT ไม่ได้ถูกกำหนดใน environment variables")
	}

	fmt.Printf("🔍 กำลังเชื่อมต่อฐานข้อมูลที่: %s:%s...\n", dbHost, dbPort)

	// สร้าง DSN พร้อม timeout parameters สำหรับ serverless environment
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?tls=true&parseTime=true&timeout=10s&readTimeout=30s&writeTimeout=30s&interpolateParams=true",
		dbUser, dbPass, dbHost, dbPort, dbName,
	)

	// เชื่อมต่อ
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Println("❌ เปิด DB พัง: ", err)
		return err
	}

	// ตั้งค่า connection pooling สำหรับ serverless
	DB.SetMaxOpenConns(5)
	DB.SetMaxIdleConns(2)
	DB.SetConnMaxLifetime(5 * time.Minute)
	DB.SetConnMaxIdleTime(1 * time.Minute)

	// ตรวจสอบการเชื่อมต่อ
	if err := DB.Ping(); err != nil {
		log.Println("❌ TiDB ปฏิเสธการเชื่อมต่อ: ", err)
		return err
	}

	// รันการตรวจสอบการย้ายฐานข้อมูล (Migration check)
	migrateDatabase(DB)

	fmt.Println("💖 ระบบหลังบ้านเชื่อมต่อ TiDB Cloud สำเร็จแล้ว!")
	return nil
}

// EnsureConnected ตรวจสอบและ reconnect ถ้า DB หลุด (สำหรับ serverless)
func EnsureConnected() error {
	if DB == nil {
		return fmt.Errorf("DB is not initialized")
	}
	if err := DB.Ping(); err != nil {
		log.Println("⚠️ DB Ping failed, attempting to reconnect:", err)
		return InitDatabase()
	}
	return nil
}

// Helper function to check if a table exists
func tableExists(db *sql.DB, tableName string) bool {
	var count int
	query := `
		SELECT COUNT(*) 
		FROM information_schema.tables 
		WHERE table_schema = DATABASE() 
		  AND table_name = ?
	`
	err := db.QueryRow(query, tableName).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

// Helper function to check if a column exists in a table
func columnExists(db *sql.DB, tableName, columnName string) bool {
	var count int
	query := `
		SELECT COUNT(*) 
		FROM information_schema.columns 
		WHERE table_schema = DATABASE() 
		  AND table_name = ? 
		  AND column_name = ?
	`
	err := db.QueryRow(query, tableName, columnName).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

// Helper function to check if an index exists on a table
func indexExists(db *sql.DB, tableName, indexName string) bool {
	var count int
	query := `
		SELECT COUNT(*) 
		FROM information_schema.statistics 
		WHERE table_schema = DATABASE() 
		  AND table_name = ? 
		  AND index_name = ?
	`
	err := db.QueryRow(query, tableName, indexName).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

// migrateDatabase ทำการลบตารางที่เลิกใช้งานและเพิ่มฟิลด์ที่จำเป็น (ถ้ายังไม่มี) แบบ Idempotent (ปลอดภัยในการรันซ้ำ)
func migrateDatabase(db *sql.DB) {
	fmt.Println("🚧 [Data Engineer] กำลังตรวจสอบและปรับปรุงโครงสร้างฐานข้อมูล...")

	// 1. Audit Logs (ลบออกตามเดิม)
	if tableExists(db, "audit_logs") {
		_, _ = db.Exec("DROP TABLE audit_logs")
		fmt.Println("  ↳ ลบตาราง audit_logs เรียบร้อย")
	}

	// 2. ปรับปรุงตาราง users
	if !columnExists(db, "users", "advisor_id") {
		_, err := db.Exec("ALTER TABLE users ADD COLUMN advisor_id INT NULL")
		if err == nil {
			_, _ = db.Exec("ALTER TABLE users ADD CONSTRAINT fk_users_advisor_id FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE SET NULL")
			fmt.Println("  ↳ เพิ่มคอลัมน์ advisor_id และความสัมพันธ์ FK ใน users สำเร็จ")
		}
	}

	// อัปเกรดประเภทข้อมูล intern_start_date & intern_end_date เป็น DATE (ไม่ใช่ VARCHAR)
	if !columnExists(db, "users", "intern_start_date") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN intern_start_date DATE NULL")
		fmt.Println("  ↳ เพิ่มคอลัมน์ intern_start_date (DATE) สำเร็จ")
	} else {
		_, _ = db.Exec("ALTER TABLE users MODIFY COLUMN intern_start_date DATE NULL")
	}

	if !columnExists(db, "users", "intern_end_date") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN intern_end_date DATE NULL")
		fmt.Println("  ↳ เพิ่มคอลัมน์ intern_end_date (DATE) สำเร็จ")
	} else {
		_, _ = db.Exec("ALTER TABLE users MODIFY COLUMN intern_end_date DATE NULL")
	}

	if !columnExists(db, "users", "intro") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN intro TEXT NULL")
	}
	if !columnExists(db, "users", "field") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN field VARCHAR(255) NULL")
	}
	if !columnExists(db, "users", "online_status") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN online_status VARCHAR(20) DEFAULT 'offline'")
	}
	if !columnExists(db, "users", "company_id") {
		_, err := db.Exec("ALTER TABLE users ADD COLUMN company_id INT NULL")
		if err == nil {
			_, _ = db.Exec("ALTER TABLE users ADD CONSTRAINT fk_users_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL")
		}
	}
	if !columnExists(db, "users", "company_role") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN company_role VARCHAR(20) NULL")
	}

	// 3. ตาราง advisor_students
	if !tableExists(db, "advisor_students") {
		_, _ = db.Exec(`CREATE TABLE advisor_students (
			advisor_id INT NOT NULL,
			student_id INT NOT NULL,
			PRIMARY KEY (advisor_id, student_id),
			FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
		fmt.Println("  ↳ สร้างตาราง advisor_students สำเร็จ")
	}

	// Migrate existing relationships
	_, _ = db.Exec("INSERT IGNORE INTO advisor_students (advisor_id, student_id) SELECT advisor_id, id FROM users WHERE advisor_id IS NOT NULL")

	// 4. ตาราง assignments
	if !tableExists(db, "assignments") {
		_, _ = db.Exec(`CREATE TABLE assignments (
			id INT AUTO_INCREMENT PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			due_date DATETIME NULL,
			points INT DEFAULT 100,
			creator_id INT NOT NULL,
			creator_role VARCHAR(50) NOT NULL,
			school_id INT NULL,
			company_id INT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
		fmt.Println("  ↳ สร้างตาราง assignments สำเร็จ")
	}

	if !columnExists(db, "assignments", "student_id") {
		_, _ = db.Exec("ALTER TABLE assignments ADD COLUMN student_id INT NULL")
	}
	if !columnExists(db, "assignments", "job_posting_id") {
		_, _ = db.Exec("ALTER TABLE assignments ADD COLUMN job_posting_id INT NULL")
	}

	// 5. ตาราง submissions
	if !tableExists(db, "submissions") {
		_, _ = db.Exec(`CREATE TABLE submissions (
			id INT AUTO_INCREMENT PRIMARY KEY,
			assignment_id INT NOT NULL,
			student_id INT NOT NULL,
			content TEXT,
			file_name VARCHAR(255) DEFAULT '',
			file_path VARCHAR(500) DEFAULT '',
			status VARCHAR(50) DEFAULT 'submitted',
			score DECIMAL(5, 2) NULL,
			feedback TEXT,
			submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			graded_at TIMESTAMP NULL,
			FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
			FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
		fmt.Println("  ↳ สร้างตาราง submissions สำเร็จ")
	}

	// 6. ปรับปรุงตาราง companies
	if !columnExists(db, "companies", "latitude") {
		_, _ = db.Exec("ALTER TABLE companies ADD COLUMN latitude DECIMAL(10, 8) NULL")
	}
	if !columnExists(db, "companies", "longitude") {
		_, _ = db.Exec("ALTER TABLE companies ADD COLUMN longitude DECIMAL(11, 8) NULL")
	}
	if !columnExists(db, "companies", "check_radius") {
		_, _ = db.Exec("ALTER TABLE companies ADD COLUMN check_radius INT DEFAULT 200")
	}

	// 7. ตาราง tickets
	if !tableExists(db, "tickets") {
		_, _ = db.Exec(`CREATE TABLE tickets (
			id INT AUTO_INCREMENT PRIMARY KEY,
			user_id INT NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT NOT NULL,
			status VARCHAR(50) DEFAULT 'open',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
		fmt.Println("  ↳ สร้างตาราง tickets สำเร็จ")
	}

	// 8. ตาราง ticket_replies
	if !tableExists(db, "ticket_replies") {
		_, _ = db.Exec(`CREATE TABLE ticket_replies (
			id INT AUTO_INCREMENT PRIMARY KEY,
			ticket_id INT NOT NULL,
			user_id INT NOT NULL,
			message TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
		fmt.Println("  ↳ สร้างตาราง ticket_replies สำเร็จ")
	}

	// 9. ปรับปรุงตาราง enrollment_codes
	if !columnExists(db, "enrollment_codes", "company_id") {
		_, err := db.Exec("ALTER TABLE enrollment_codes ADD COLUMN company_id INT NULL")
		if err == nil {
			_, _ = db.Exec("ALTER TABLE enrollment_codes ADD CONSTRAINT fk_enrollment_codes_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL")
		}
	}
	if !columnExists(db, "enrollment_codes", "company_name") {
		_, _ = db.Exec("ALTER TABLE enrollment_codes ADD COLUMN company_name VARCHAR(255) NULL")
	}
	if !columnExists(db, "enrollment_codes", "company_address") {
		_, _ = db.Exec("ALTER TABLE enrollment_codes ADD COLUMN company_address TEXT NULL")
	}
	if !columnExists(db, "enrollment_codes", "company_description") {
		_, _ = db.Exec("ALTER TABLE enrollment_codes ADD COLUMN company_description TEXT NULL")
	}

	// Sync company ID in users
	_, _ = db.Exec("UPDATE users u JOIN companies c ON c.user_id = u.id SET u.company_id = c.id WHERE u.company_id IS NULL")

	// Sync company roles
	_, _ = db.Exec("UPDATE users u JOIN companies c ON c.user_id = u.id SET u.company_role = 'admin' WHERE u.role = 'company' AND u.company_role IS NULL")
	_, _ = db.Exec("UPDATE users SET company_role = 'employee' WHERE role = 'company' AND company_role IS NULL AND company_id IS NOT NULL")

	// 10. ตาราง logbooks
	if !columnExists(db, "logbooks", "work_date") {
		_, _ = db.Exec("ALTER TABLE logbooks ADD COLUMN work_date DATE NULL")
	}

	// 11. ตาราง attendances
	if !columnExists(db, "attendances", "is_wfh") {
		_, _ = db.Exec("ALTER TABLE attendances ADD COLUMN is_wfh BOOLEAN DEFAULT FALSE")
	}
	if !columnExists(db, "attendances", "notes") {
		_, _ = db.Exec("ALTER TABLE attendances ADD COLUMN notes TEXT NULL")
	}

	// 12. Evaluation system
	if !tableExists(db, "evaluation_templates") {
		_, _ = db.Exec(`CREATE TABLE evaluation_templates (
			id INT AUTO_INCREMENT PRIMARY KEY,
			created_by INT NOT NULL,
			name VARCHAR(255) NOT NULL DEFAULT 'แบบประเมิน',
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
	}

	if !tableExists(db, "evaluation_criteria") {
		_, _ = db.Exec(`CREATE TABLE evaluation_criteria (
			id INT AUTO_INCREMENT PRIMARY KEY,
			template_id INT NOT NULL,
			label VARCHAR(255) NOT NULL,
			max_score INT NOT NULL DEFAULT 10,
			sort_order INT DEFAULT 0,
			FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
	}

	if !tableExists(db, "evaluation_scores") {
		_, _ = db.Exec(`CREATE TABLE evaluation_scores (
			id INT AUTO_INCREMENT PRIMARY KEY,
			evaluation_id INT NOT NULL,
			criterion_id INT NOT NULL,
			score FLOAT NOT NULL DEFAULT 0,
			FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
			FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
	}

	// 13. Extra student fields
	if !columnExists(db, "users", "number") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN number INT NOT NULL DEFAULT 0")
	}
	if !columnExists(db, "users", "year_level") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN year_level VARCHAR(20) NOT NULL DEFAULT ''")
	}
	if !columnExists(db, "users", "class_group") {
		_, _ = db.Exec("ALTER TABLE users ADD COLUMN class_group VARCHAR(50) NOT NULL DEFAULT ''")
	}

	// 14. [Performance Optimization] การตั้งดัชนี (Indexes) บน lookup paths ความเร็วสูง
	if !indexExists(db, "users", "idx_users_company_id") {
		_, _ = db.Exec("CREATE INDEX idx_users_company_id ON users(company_id)")
	}
	if !indexExists(db, "users", "idx_users_advisor_id") {
		_, _ = db.Exec("CREATE INDEX idx_users_advisor_id ON users(advisor_id)")
	}
	if !indexExists(db, "attendances", "idx_attendances_student_id_created") {
		_, _ = db.Exec("CREATE INDEX idx_attendances_student_id_created ON attendances(student_id, created_at)")
	}
	if !indexExists(db, "logbooks", "idx_logbooks_student_id_work") {
		_, _ = db.Exec("CREATE INDEX idx_logbooks_student_id_work ON logbooks(student_id, work_date)")
	}



	fmt.Println("✅ [Data Engineer] การปรับปรุงโครงสร้างฐานข้อมูลเสร็จสิ้นเรียบร้อย!")
}


// GetDB ส่งคืนฐานข้อมูล connection
func GetDB() *sql.DB {
	return DB
}

// CloseDatabase ปิดการเชื่อมต่อ
func CloseDatabase() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
