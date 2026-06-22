package handler

import (
	"net/http"
	"sync"

	"internship-backend/config"
	"internship-backend/routes"

	"github.com/gin-gonic/gin"
)

var (
	router     *gin.Engine
	once       sync.Once
	initDbErr  error
)

func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(func() {
		// Set Gin to release mode for production in Vercel serverless
		gin.SetMode(gin.ReleaseMode)

		// Initialize Database Connection
		initDbErr = config.InitDatabase()
		if initDbErr == nil {
			router = gin.New()
			router.Use(gin.Recovery())
			routes.SetupRoutes(router)
		}
	})

	// If router is nil (init failed), try to reinitialize
	if router == nil {
		// Attempt re-initialization on each request if first init failed
		if err := config.InitDatabase(); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status":503,"error":"database connection failed: ` + err.Error() + `"}`))
			return
		}
		router = gin.New()
		router.Use(gin.Recovery())
		routes.SetupRoutes(router)
	}

	router.ServeHTTP(w, r)
}
