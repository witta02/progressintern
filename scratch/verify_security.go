//go:build ignore

package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

const baseURL = "http://localhost:8080"

func main() {
	godotenv.Load()

	// 1. Connection to DB for validation checks
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?tls=true&parseTime=true&timeout=5s&readTimeout=5s&writeTimeout=5s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("❌ Open DB failed: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("❌ Ping DB failed: %v", err)
	}
	fmt.Println("🚀 Connected to database successfully.")

	// Clean up any old test users
	testEmail := "test_security_user@example.com"
	_, err = db.Exec("DELETE FROM users WHERE email = ?", testEmail)
	if err != nil {
		log.Fatalf("❌ Cleanup failed: %v", err)
	}

	// ==========================================
	// 2. Verify Password Complexity
	// ==========================================
	fmt.Println("\n--- Testing Password Complexity ---")
	weakPassword := "123456"
	registerPayload := map[string]interface{}{
		"name":     "Test Security User",
		"email":    testEmail,
		"password": weakPassword,
		"role":     "student",
		"school":   "Test School",
		"phone":    "0888888888",
	}

	body, _ := json.Marshal(registerPayload)
	resp, err := http.Post(baseURL+"/api/auth/register", "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Fatalf("❌ API request failed: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == 400 && strings.Contains(string(respBody), "รหัสผ่านไม่ปลอดภัย") {
		fmt.Printf("✅ Weak password registration rejected successfully: %s\n", strings.TrimSpace(string(respBody)))
	} else {
		log.Fatalf("❌ Expected weak password rejection (400), got status %d: %s", resp.StatusCode, string(respBody))
	}

	// ==========================================
	// 3. Verify Strong Password Registration
	// ==========================================
	fmt.Println("\n--- Testing Strong Password Registration ---")
	strongPassword := "P@ssword123!"
	registerPayload["password"] = strongPassword
	body, _ = json.Marshal(registerPayload)
	resp, err = http.Post(baseURL+"/api/auth/register", "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Fatalf("❌ API request failed: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ = io.ReadAll(resp.Body)
	if resp.StatusCode == 201 {
		fmt.Printf("✅ Strong password registration succeeded: %s\n", strings.TrimSpace(string(respBody)))
	} else {
		log.Fatalf("❌ Strong password registration failed, status %d: %s", resp.StatusCode, string(respBody))
	}

	// ==========================================
	// 4. Verify Login and Active Status Checks
	// ==========================================
	fmt.Println("\n--- Testing Login and Active JWT Checks ---")
	loginPayload := map[string]string{
		"email":    testEmail,
		"password": strongPassword,
	}
	body, _ = json.Marshal(loginPayload)
	resp, err = http.Post(baseURL+"/api/auth/login", "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Fatalf("❌ Login request failed: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ = io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		log.Fatalf("❌ Login failed, status %d: %s", resp.StatusCode, string(respBody))
	}
	fmt.Println("✅ Login succeeded.")

	var loginResponse struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	json.Unmarshal(respBody, &loginResponse)
	token := loginResponse.Data.Token
	if token == "" {
		log.Fatalf("❌ No JWT token returned in login response")
	}

	// Access a protected route: /api/users
	client := &http.Client{}
	req, _ := http.NewRequest("GET", baseURL+"/api/users", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err = client.Do(req)
	if err != nil {
		log.Fatalf("❌ Protected request failed: %v", err)
	}
	defer resp.Body.Close()
	respBody, _ = io.ReadAll(resp.Body)
	if resp.StatusCode == 200 {
		fmt.Println("✅ Accessed protected route successfully with valid token.")
	} else {
		log.Fatalf("❌ Failed to access protected route with valid token, status %d: %s", resp.StatusCode, string(respBody))
	}

	// Disable/reject the user in the database
	fmt.Println("Updating user status to 'rejected' in database...")
	_, err = db.Exec("UPDATE users SET status = 'rejected' WHERE email = ?", testEmail)
	if err != nil {
		log.Fatalf("❌ DB update failed: %v", err)
	}

	// Re-attempt accessing protected route with the SAME token
	resp, err = client.Do(req)
	if err != nil {
		log.Fatalf("❌ Protected request failed: %v", err)
	}
	defer resp.Body.Close()
	respBody, _ = io.ReadAll(resp.Body)
	if resp.StatusCode == 403 && strings.Contains(string(respBody), "บัญชีของคุณถูกระงับการใช้งาน") {
		fmt.Printf("✅ Rejected user blocked successfully (403 Forbidden): %s\n", strings.TrimSpace(string(respBody)))
	} else {
		log.Fatalf("❌ Expected 403 Forbidden block for rejected user, got status %d: %s", resp.StatusCode, string(respBody))
	}

	// Restore user status to active for further checks
	_, _ = db.Exec("UPDATE users SET status = 'active' WHERE email = ?", testEmail)

	// ==========================================
	// 5. Verify Rate Limiting (429 Too Many Requests)
	// ==========================================
	fmt.Println("\n--- Testing Rate Limiting (expecting 429) ---")
	// The rate limiter is set to 5 attempts per minute. We already did:
	// - 1 weak password register (fails)
	// - 1 strong password register (succeeds)
	// - 1 login (succeeds)
	// That's 3 requests. Let's make 5 more login requests immediately.
	limiterTriggered := false
	for i := 1; i <= 6; i++ {
		resp, err = http.Post(baseURL+"/api/auth/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			log.Fatalf("❌ Login request %d failed: %v", i, err)
		}
		respBody, _ = io.ReadAll(resp.Body)
		resp.Body.Close()
		fmt.Printf("Request %d: Status %d\n", i, resp.StatusCode)
		if resp.StatusCode == 429 {
			fmt.Printf("✅ Rate limiter triggered at request %d: %s\n", i, strings.TrimSpace(string(respBody)))
			limiterTriggered = true
			break
		}
		// Small delay to make sure request is logged sequentially
		time.Sleep(10 * time.Millisecond)
	}

	if !limiterTriggered {
		log.Fatalf("❌ Rate limiter was not triggered after multiple login attempts!")
	}

	// Clean up
	_, _ = db.Exec("DELETE FROM users WHERE email = ?", testEmail)
	fmt.Println("\n🎉 All tests passed successfully!")
}
