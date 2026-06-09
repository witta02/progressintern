package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"

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

	// สร้าง DSN
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?tls=true&parseTime=true", dbUser, dbPass, dbHost, dbPort, dbName)

	// เชื่อมต่อ
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Println("❌ เปิด DB พัง: ", err)
		return err
	}

	// ตรวจสอบการเชื่อมต่อ
	if err := DB.Ping(); err != nil {
		log.Println("❌ TiDB ปฏิเสธการเชื่อมต่อ: ", err)
		return err
	}

	// ตั้งค่า connection pooling
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)

	fmt.Println("💖 ระบบหลังบ้านเชื่อมต่อ TiDB Cloud สำเร็จแล้ว!")
	return nil
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
