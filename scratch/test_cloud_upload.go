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

type RegisterResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
}

type LoginResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
	Data    struct {
		Token string `json:"token"`
	} `json:"data"`
}

type UploadResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
	Data    struct {
		FilePath string `json:"file_path"`
		FileName string `json:"file_name"`
	} `json:"data"`
}

func main() {
	client := &http.Client{Timeout: 30 * time.Second}
	email := fmt.Sprintf("teststudent_%d@gmail.com", time.Now().Unix())
	password := "Password123!"

	// 1. Register test student
	regPayload, _ := json.Marshal(map[string]interface{}{
		"name":            "Test Cloud Student",
		"email":           email,
		"password":        password,
		"role":            "student",
		"school":          "Bangkok University",
		"code":            "TNK-STU-2026",
		"contact_email":   email,
	})
	respReg, err := http.Post("http://localhost:8080/api/auth/register", "application/json", bytes.NewBuffer(regPayload))
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
	respLog, err := http.Post("http://localhost:8080/api/auth/login", "application/json", bytes.NewBuffer(loginPayload))
	if err != nil {
		fmt.Printf("Login request failed: %v\n", err)
		return
	}
	defer respLog.Body.Close()

	if respLog.StatusCode != http.StatusOK {
		bodyLog, _ := io.ReadAll(respLog.Body)
		fmt.Printf("Login failed with status %d: %s\n", respLog.StatusCode, string(bodyLog))
		return
	}

	var loginRes LoginResponse
	_ = json.NewDecoder(respLog.Body).Decode(&loginRes)
	token := loginRes.Data.Token
	fmt.Println("🔑 Login successful! Got token:", token[:15]+"...")

	// 3. Upload file
	bodyBuf := &bytes.Buffer{}
	bodyWriter := multipart.NewWriter(bodyBuf)
	fileWriter, err := bodyWriter.CreateFormFile("file", "test_report.pdf")
	if err != nil {
		fmt.Printf("Failed to create form file: %v\n", err)
		return
	}
	_, _ = fileWriter.Write([]byte("%PDF-1.4 ... Dummy PDF Content for Testing Cloud Upload ..."))
	bodyWriter.Close()

	req, _ := http.NewRequest("POST", "http://localhost:8080/api/upload", bodyBuf)
	req.Header.Set("Content-Type", bodyWriter.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	respUp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Upload request failed: %v\n", err)
		return
	}
	defer respUp.Body.Close()

	bodyUp, _ := io.ReadAll(respUp.Body)
	if respUp.StatusCode != http.StatusOK {
		fmt.Printf("Upload failed with status %d: %s\n", respUp.StatusCode, string(bodyUp))
		return
	}

	var uploadRes UploadResponse
	_ = json.Unmarshal(bodyUp, &uploadRes)
	fmt.Println("☁️ Upload successful!")
	fmt.Printf("Saved File URL: %s\n", uploadRes.Data.FilePath)
	fmt.Printf("Saved File Name: %s\n", uploadRes.Data.FileName)
}
