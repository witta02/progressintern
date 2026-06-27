package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	hash := "$2a$10$KaVx.FJyRp0Odg4TsWNbG.EH7L1WCjOa1AEqPoqRx3DtyPGCeUADq"
	passwords := []string{
		"student",
		"student123",
		"password",
		"password123",
		"123456",
		"12345678",
		"SecurePassword123",
		"TestPass123",
		"admin",
		"admin123",
	}

	for _, p := range passwords {
		err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(p))
		if err == nil {
			fmt.Printf("🎉 FOUND PASSWORD: %s\n", p)
			return
		}
	}
	fmt.Println("❌ Password not found in common list")
}
