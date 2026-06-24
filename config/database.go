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
