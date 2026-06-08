package main

import (
	"fmt"
	"internship-backend/config"
	"internship-backend/routes"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var engine *gin.Engine

func init() {
	_ = godotenv.Load()
	if err := config.InitDatabase(); err != nil {
		log.Println("❌ ล้มเหลวในการเชื่อมต่อฐานข้อมูล:", err)
	}

	gin.SetMode(gin.ReleaseMode)
	engine = gin.Default()
	routes.SetupRoutes(engine)
}

// Handler is the entry point for Vercel
func Handler(w http.ResponseWriter, r *http.Request) {
	engine.ServeHTTP(w, r)
}

func main() {
	if os.Getenv("VERCEL") == "" {
		fmt.Println("🚀 API Server รันพร้อมใช้งานแล้วบนพอร์ต :8080")
		if err := engine.Run(":8080"); err != nil {
			log.Fatal("❌ Server พัง:", err)
		}
	}
}
