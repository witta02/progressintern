package main

import (
	"fmt"
	"log"
	"os"

	"internship-backend/app"
	"internship-backend/config"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	if err := config.InitDatabase(); err != nil {
		log.Fatal("Database connection failed:", err)
	}
	defer config.CloseDatabase()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("API server listening on port " + port)
	if err := app.NewRouter().Run(":" + port); err != nil {
		log.Fatal("Server failed:", err)
	}
}
