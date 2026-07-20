//go:build ignore

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

type LoginResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
	Error   string `json:"error"`
	Data    struct {
		Token string `json:"token"`
	} `json:"data"`
}

func main() {
	client := &http.Client{Timeout: 45 * time.Second}
	email := fmt.Sprintf("teststudent_%d@gmail.com", time.Now().Unix())
	password := "Password123!"

	baseURL := "https://proim.vercel.app"

	// 1. Register test student
	regPayload, _ := json.Marshal(map[string]interface{}{
		"name":            "Test Vercel Student",
		"email":           email,
		"password":        password,
		"role":            "student",
		"school":          "Bangkok University",
		"code":            "TNK-STU-2026",
		"contact_email":   email,
	})
	
	fmt.Printf("1. Registering student at %s/api/auth/register...\n", baseURL)
	respReg, err := http.Post(baseURL+"/api/auth/register", "application/json", bytes.NewBuffer(regPayload))
	if err != nil {
		fmt.Printf("Register request failed: %v\n", err)
		return
	}
	defer respReg.Body.Close()

	bodyReg, _ := io.ReadAll(respReg.Body)
	if respReg.StatusCode != http.StatusOK && respReg.StatusCode != http.StatusCreated {
		fmt.Printf("Register failed with status %d: %s\n", respReg.StatusCode, string(bodyReg))
		return
	}
	fmt.Printf("👤 Registered student successfully! Email: %s\n", email)

	// 2. Login
	loginPayload, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})
	fmt.Printf("2. Logging in at %s/api/auth/login...\n", baseURL)
	respLog, err := http.Post(baseURL+"/api/auth/login", "application/json", bytes.NewBuffer(loginPayload))
	if err != nil {
		fmt.Printf("Login request failed: %v\n", err)
		return
	}
	defer respLog.Body.Close()

	bodyLog, _ := io.ReadAll(respLog.Body)
	if respLog.StatusCode != http.StatusOK {
		fmt.Printf("Login failed with status %d: %s\n", respLog.StatusCode, string(bodyLog))
		return
	}

	var loginRes LoginResponse
	_ = json.Unmarshal(bodyLog, &loginRes)
	token := loginRes.Data.Token
	fmt.Println("🔑 Login successful! Got token:", token[:15]+"...")

	// 3. Upload file
	bodyBuf := &bytes.Buffer{}
	bodyWriter := multipart.NewWriter(bodyBuf)
	fileWriter, err := bodyWriter.CreateFormFile("file", "test_vercel_report.pdf")
	if err != nil {
		fmt.Printf("Failed to create form file: %v\n", err)
		return
	}
	_, _ = fileWriter.Write([]byte("%PDF-1.4 ... Dummy PDF Content for Testing Vercel Cloud Upload ..."))
	bodyWriter.Close()

	fmt.Printf("3. Uploading file to %s/api/upload...\n", baseURL)
	req, _ := http.NewRequest("POST", baseURL+"/api/upload", bodyBuf)
	req.Header.Set("Content-Type", bodyWriter.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	respUp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Upload request failed: %v\n", err)
		return
	}
	defer respUp.Body.Close()

	bodyUp, _ := io.ReadAll(respUp.Body)
	fmt.Printf("Upload status: %d\n", respUp.StatusCode)
	fmt.Printf("Upload raw response: %s\n", string(bodyUp))
}
