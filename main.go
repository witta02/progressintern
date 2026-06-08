package main

import (
	"fmt"
	"internship-backend/config"
	"internship-backend/routes"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// โหลด .env file (เฉพาะตอนรัน local)
	_ = godotenv.Load()

	// เชื่อมต่อฐานข้อมูล
	if err := config.InitDatabase(); err != nil {
		log.Fatal("❌ ล้มเหลวในการเชื่อมต่อฐานข้อมูล:", err)
	}
	defer config.CloseDatabase()

	// ตั้งค่า Gin mode
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// สร้าง Gin router
	r := gin.Default()

	// เซตอัพ routes ทั้งหมด
	routes.SetupRoutes(r)

	// ดึงพอร์ตจาก Environment Variable (Vercel กำหนดให้)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// เริ่มต้น server
	fmt.Printf("🚀 API Server รันพร้อมใช้งานแล้วบนพอร์ต :%s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("❌ Server พัง:", err)
	}
}
