package main

import (
	"fmt"
	"internship-backend/config"
	"internship-backend/routes"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	if err := config.InitDatabase(); err != nil {
		log.Fatal("❌ ล้มเหลวในการเชื่อมต่อฐานข้อมูล:", err)
	}
	defer config.CloseDatabase()

	r := gin.Default()
	routes.SetupRoutes(r)

	fmt.Println("🚀 API Server รันพร้อมใช้งานแล้วบนพอร์ต :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("❌ Server พัง:", err)
	}
}
