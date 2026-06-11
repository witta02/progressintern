package routes

import (
	"internship-backend/handlers"
	"internship-backend/middleware"
	"time"

	"github.com/gin-gonic/gin"
)

// SetupRoutes เซตอัพทุก API routes
func SetupRoutes(router *gin.Engine) {
	// CORS Middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE, PATCH")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Health Check
	router.GET("/api/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "message": "Backend is running and reachable"})
	})

	// ========================================================
	// 🔐 Authentication Routes (ไม่ต้อง token)
	// ========================================================
	authGroup := router.Group("/api/auth")
	authGroup.Use(middleware.RateLimiter(5, time.Minute))
	{
		authGroup.POST("/register", handlers.RegisterHandler)
		authGroup.POST("/login", handlers.LoginHandler)
	}

	// ========================================================
	// 👤 User Routes
	// ========================================================
	userGroup := router.Group("/api/users")
	userGroup.Use(middleware.AuthMiddleware())
	{
		userGroup.GET("", handlers.GetAllUsersHandler)
		userGroup.GET("/:id", handlers.GetUserByIDHandler)
		userGroup.PUT("/:id", handlers.UpdateUserHandler)
	}

	// ========================================================
	// 🏢 Company Routes
	// ========================================================
	companyGroup := router.Group("/api/companies")
	{
		companyGroup.GET("", handlers.GetAllCompaniesHandler)
	}

	// ========================================================
	// 💼 Job & Application Routes
	// ========================================================
	jobGroup := router.Group("/api/jobs")
	{
		jobGroup.POST("", middleware.AuthMiddleware(), middleware.RequireRole("company", "admin"), handlers.CreateJobHandler)
		jobGroup.GET("", handlers.GetAllJobsHandler)
		jobGroup.PUT("/:id/status", middleware.AuthMiddleware(), middleware.RequireRole("company", "admin"), handlers.CloseJobHandler)
		jobGroup.DELETE("/:id", middleware.AuthMiddleware(), middleware.RequireRole("company", "admin"), handlers.DeleteJobHandler)
	}

	appGroup := router.Group("/api/applications")
	appGroup.Use(middleware.AuthMiddleware())
	{
		appGroup.POST("", handlers.ApplyJobHandler)
		appGroup.GET("", handlers.GetAllApplicationsHandler)
		appGroup.GET("/company/:id", handlers.GetCompanyAppsHandler)
		appGroup.PUT("/:id/status", handlers.UpdateAppStatusHandler)
	}

	// ========================================================
	// 🎓 Internship Routes
	// ========================================================
	internshipGroup := router.Group("/api/internships")
	internshipGroup.Use(middleware.AuthMiddleware())
	{
		internshipGroup.GET("", handlers.GetAllInternshipsHandler)
		internshipGroup.POST("", handlers.CreateInternshipHandler)
	}

	// ========================================================
	// 📍 Attendance Routes
	// ========================================================
	attendanceGroup := router.Group("/api/attendance")
	attendanceGroup.Use(middleware.AuthMiddleware())
	{
		attendanceGroup.POST("/check-in", handlers.CheckInHandler)
		attendanceGroup.PUT("/check-out", handlers.CheckOutHandler)
		attendanceGroup.GET("", handlers.GetAllAttendancesHandler)
	}

	// ========================================================
	// 📝 Logbook Routes
	// ========================================================
	logbookGroup := router.Group("/api/logbooks")
	logbookGroup.Use(middleware.AuthMiddleware())
	{
		logbookGroup.POST("", handlers.CreateLogbookHandler)
		logbookGroup.GET("", handlers.GetAllLogbooksHandler)
		logbookGroup.PUT("/:id/approve", handlers.ApproveLogbookHandler)
	}

	// ========================================================
	// ⭐ Evaluation Routes
	// ==================== Evaluation Routes ====================
	evaluationGroup := router.Group("/api/evaluations")
	evaluationGroup.Use(middleware.AuthMiddleware())
	{
		evaluationGroup.GET("", handlers.GetAllEvaluationsHandler)
		evaluationGroup.POST("", handlers.CreateEvaluationHandler)
	}

	// ========================================================
	// 🏖️ Leave Routes
	// ========================================================
	leaveGroup := router.Group("/api/leaves")
	leaveGroup.Use(middleware.AuthMiddleware())
	{
		leaveGroup.POST("", handlers.CreateLeaveHandler)
		leaveGroup.GET("", handlers.GetAllLeavesHandler)
		leaveGroup.PUT("/:id/status", handlers.UpdateLeaveStatusHandler)
	}
	}

