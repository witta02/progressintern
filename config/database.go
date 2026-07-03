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

// migrateDatabase ทำการลบตารางที่เลิกใช้งานและเพิ่มฟิลด์ที่จำเป็น (ถ้ายังไม่มี)
func migrateDatabase(db *sql.DB) {
	// ponytail: run drop/alter commands directly, ignoring duplicate errors
	_, _ = db.Exec("DROP TABLE IF EXISTS audit_logs")
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN advisor_id INT NULL")
	_, _ = db.Exec("ALTER TABLE users ADD CONSTRAINT fk_users_advisor_id FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE SET NULL")
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN intern_start_date VARCHAR(10) NULL")
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN intern_end_date VARCHAR(10) NULL")
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN intro TEXT NULL")
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN field VARCHAR(255) NULL")

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS advisor_students (
		advisor_id INT NOT NULL,
		student_id INT NOT NULL,
		PRIMARY KEY (advisor_id, student_id),
		FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)

	// Migrate existing relationships from users table to advisor_students
	_, _ = db.Exec("INSERT IGNORE INTO advisor_students (advisor_id, student_id) SELECT advisor_id, id FROM users WHERE advisor_id IS NOT NULL")

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS assignments (
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

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS submissions (
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

	_, _ = db.Exec("ALTER TABLE companies ADD COLUMN latitude DECIMAL(10, 8) NULL")
	_, _ = db.Exec("ALTER TABLE companies ADD COLUMN longitude DECIMAL(11, 8) NULL")
	_, _ = db.Exec("ALTER TABLE assignments ADD COLUMN student_id INT NULL")
	_, _ = db.Exec("ALTER TABLE assignments ADD COLUMN job_posting_id INT NULL")

	// --- TICKET SYSTEM & MULTI-USER COMPANY PRIVILEGES ---
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS tickets (
		id INT AUTO_INCREMENT PRIMARY KEY,
		user_id INT NOT NULL,
		title VARCHAR(255) NOT NULL,
		description TEXT NOT NULL,
		status VARCHAR(50) DEFAULT 'open',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS ticket_replies (
		id INT AUTO_INCREMENT PRIMARY KEY,
		ticket_id INT NOT NULL,
		user_id INT NOT NULL,
		message TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)

	_, _ = db.Exec("ALTER TABLE users ADD COLUMN company_id INT NULL")
	_, _ = db.Exec("ALTER TABLE users ADD CONSTRAINT fk_users_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL")
	_, _ = db.Exec("ALTER TABLE enrollment_codes ADD COLUMN company_id INT NULL")
	_, _ = db.Exec("ALTER TABLE enrollment_codes ADD CONSTRAINT fk_enrollment_codes_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL")
	_, _ = db.Exec("ALTER TABLE enrollment_codes ADD COLUMN company_name VARCHAR(255) NULL")
	_, _ = db.Exec("ALTER TABLE enrollment_codes ADD COLUMN company_address TEXT NULL")
	_, _ = db.Exec("ALTER TABLE enrollment_codes ADD COLUMN company_description TEXT NULL")

	// Migrate existing company users to link their company_id column to their companies record
	_, _ = db.Exec("UPDATE users u JOIN companies c ON c.user_id = u.id SET u.company_id = c.id WHERE u.company_id IS NULL")

	// --- COMPANY ADMIN / EMPLOYEE SUB-ROLES ---
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN company_role VARCHAR(20) NULL")
	// Existing company users (primary owner in companies table) become admin
	_, _ = db.Exec("UPDATE users u JOIN companies c ON c.user_id = u.id SET u.company_role = 'admin' WHERE u.role = 'company' AND u.company_role IS NULL")
	// Other company users linked by company_id but not the primary owner become employee
	_, _ = db.Exec("UPDATE users SET company_role = 'employee' WHERE role = 'company' AND company_role IS NULL AND company_id IS NOT NULL")

	// --- LOGBOOK WORK DATE, COMPANY RADIUS, AND EVALUATION RUBRICS ---
	_, _ = db.Exec("ALTER TABLE logbooks ADD COLUMN work_date DATE NULL")
	_, _ = db.Exec("ALTER TABLE companies ADD COLUMN check_radius INT DEFAULT 200")

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS evaluation_templates (
		id INT AUTO_INCREMENT PRIMARY KEY,
		created_by INT NOT NULL,
		name VARCHAR(255) NOT NULL DEFAULT 'แบบประเมิน',
		is_active BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS evaluation_criteria (
		id INT AUTO_INCREMENT PRIMARY KEY,
		template_id INT NOT NULL,
		label VARCHAR(255) NOT NULL,
		max_score INT NOT NULL DEFAULT 10,
		sort_order INT DEFAULT 0,
		FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS evaluation_scores (
		id INT AUTO_INCREMENT PRIMARY KEY,
		evaluation_id INT NOT NULL,
		criterion_id INT NOT NULL,
		score FLOAT NOT NULL DEFAULT 0,
		FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
		FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
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
