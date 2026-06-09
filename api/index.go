package handler

import (
	"net/http"
	"sync"

	"internship-backend/config"
	"internship-backend/routes"

	"github.com/gin-gonic/gin"
)

var (
	router *gin.Engine
	once   sync.Once
	dbErr  error
)

func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(func() {
		// Set Gin to release mode for production in Vercel serverless
		gin.SetMode(gin.ReleaseMode)

		// Initialize Database Connection
		dbErr = config.InitDatabase()
		if dbErr == nil {
			router = gin.Default()
			routes.SetupRoutes(router)
		}
	})

	if dbErr != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"status":"error","message":"database connection failed: ` + dbErr.Error() + `"}`))
		return
	}

	router.ServeHTTP(w, r)
}
