package routes

import (
	"internship-backend/handlers"
	"internship-backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRoutes เซตอัพทุก API routes
func SetupRoutes(router *gin.Engine) {
	// CORS Middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// ========================================================
	// 🔐 Authentication Routes (ไม่ต้อง token)
	// ========================================================
	authGroup := router.Group("/api/auth")
	{
		authGroup.POST("/register", handlers.RegisterHandler)
		authGroup.POST("/login", handlers.LoginHandler)
	}

	// ========================================================
	// 💼 Job & Application Routes
	// ========================================================
	jobGroup := router.Group("/api/jobs")
	{
		jobGroup.POST("", middleware.AuthMiddleware(), handlers.CreateJobHandler)
		jobGroup.GET("", handlers.GetAllJobsHandler)
	}

	router.GET("/api/health", handlers.HealthHandler)
	router.GET("/api/users", middleware.AuthMiddleware(), handlers.GetUsersHandler)
	router.GET("/api/companies", handlers.GetCompaniesHandler)
	router.GET("/api/internships", middleware.AuthMiddleware(), handlers.GetInternshipsHandler)
	router.POST("/api/internships", middleware.AuthMiddleware(), handlers.CreateInternshipHandler)
	router.GET("/api/evaluations", middleware.AuthMiddleware(), handlers.GetEvaluationsHandler)
	router.POST("/api/evaluations", middleware.AuthMiddleware(), handlers.CreateEvaluationHandler)

	appGroup := router.Group("/api/applications")
	appGroup.Use(middleware.AuthMiddleware())
	{
		appGroup.POST("", handlers.ApplyJobHandler)
		appGroup.GET("", handlers.GetApplicationsHandler)
		appGroup.GET("/company/:id", handlers.GetCompanyAppsHandler)
		appGroup.PUT("/:id/status", handlers.UpdateAppStatusHandler)
	}

	// ========================================================
	// 📍 Attendance Routes
	// ========================================================
	attendanceGroup := router.Group("/api/attendance")
	attendanceGroup.Use(middleware.AuthMiddleware())
	{
		attendanceGroup.GET("", handlers.GetAttendancesHandler)
		attendanceGroup.POST("/check-in", handlers.CheckInHandler)
		attendanceGroup.PUT("/check-out", handlers.CheckOutHandler)
	}

	// ========================================================
	// 📝 Logbook Routes
	// ========================================================
	logbookGroup := router.Group("/api/logbooks")
	logbookGroup.Use(middleware.AuthMiddleware())
	{
		logbookGroup.GET("", handlers.GetLogbooksHandler)
		logbookGroup.POST("", handlers.CreateLogbookHandler)
		logbookGroup.PUT("/:id/approve", handlers.ApproveLogbookHandler)
	}
}
