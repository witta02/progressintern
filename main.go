package handler

import (
	"internship-backend/config"
	"internship-backend/routes"
	"log"
	"net/http"

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

func Handler(w http.ResponseWriter, r *http.Request) {
	engine.ServeHTTP(w, r)
}
