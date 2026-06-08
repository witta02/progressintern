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
	_ = godotenv.Load()

	if err := config.InitDatabase(); err != nil {
		log.Fatal("❌ ล้มเหลวในการเชื่อมต่อฐานข้อมูล:", err)
	}
	defer config.CloseDatabase()

	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()
	routes.SetupRoutes(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 API Server รันพร้อมใช้งานแล้วบนพอร์ต :%s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("❌ Server พัง:", err)
	}
}
