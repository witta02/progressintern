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
