package app

import (
	"internship-backend/BackEnd/routes"

	"github.com/gin-gonic/gin"
)

func NewRouter() *gin.Engine {
	router := gin.Default()
	routes.SetupRoutes(router)
	return router
}
