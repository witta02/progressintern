package main

import (
	"fmt"
	"internship-backend/config"
	"internship-backend/routes"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// ========================================================
// 🚀 MAIN FUNCTION - Entry Point
// ========================================================

func main() {
	// โหลด .env file (พยายามหาในที่ต่างๆ)
	err := godotenv.Load()
	if err != nil {
		err = godotenv.Load("../../.env")
	}
	if err != nil {
		log.Println("⚠️ ไม่พบไฟล์ .env - ใช้ environment variables จาก system")
	}

	// เชื่อมต่อฐานข้อมูล
	if err := config.InitDatabase(); err != nil {
		log.Fatal("❌ ล้มเหลวในการเชื่อมต่อฐานข้อมูล:", err)
	}
	defer config.CloseDatabase()

	// สร้าง Gin router
	r := gin.Default()

	// เซตอัพ routes ทั้งหมด
	routes.SetupRoutes(r)

	// เริ่มต้น server
	fmt.Println("🚀 API Server รันพร้อมใช้งานแล้วบนพอร์ต :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("❌ Server พัง:", err)
	}
}
