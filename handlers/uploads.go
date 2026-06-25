package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
	"internship-backend/models"

	"github.com/gin-gonic/gin"
)

// UploadFileHandler handles uploads by forwarding the file to gofile.io for cloud storage
func UploadFileHandler(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Status:  http.StatusBadRequest,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้",
			Error:   "กรุณาแนบไฟล์ที่ต้องการอัปโหลด (No file found in request)",
		})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้",
			Error:   err.Error(),
		})
		return
	}
	defer src.Close()

	// Forward file to gofile.io
	bodyBuf := &bytes.Buffer{}
	bodyWriter := multipart.NewWriter(bodyBuf)

	// Add file parameter
	fileWriter, err := bodyWriter.CreateFormFile("file", file.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้",
			Error:   err.Error(),
		})
		return
	}

	_, err = io.Copy(fileWriter, src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้",
			Error:   err.Error(),
		})
		return
	}
	bodyWriter.Close()

	req, err := http.NewRequest("POST", "https://upload.gofile.io/uploadFile", bodyBuf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้",
			Error:   err.Error(),
		})
		return
	}
	req.Header.Set("Content-Type", bodyWriter.FormDataContentType())

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้ (เชื่อมต่อ Cloud Storage ล้มเหลว)",
			Error:   err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil || resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้ (Cloud Storage ปฏิเสธ)",
			Error:   string(respBody),
		})
		return
	}

	var gfResp struct {
		Status string `json:"status"`
		Data   struct {
			DownloadPage string `json:"downloadPage"`
			Name         string `json:"name"`
			ID           string `json:"id"`
		} `json:"data"`
	}

	if err := json.Unmarshal(respBody, &gfResp); err != nil || gfResp.Status != "ok" {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้ (ผลลัพธ์จัดเก็บล้มเหลว)",
			Error:   string(respBody),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Status:  http.StatusOK,
		Message: "อัปโหลดไฟล์สำเร็จ (Cloud)",
		Data: gin.H{
			"file_path": gfResp.Data.DownloadPage,
			"file_name": file.Filename,
		},
	})
}

// GetUploadsDir returns the directory path for file uploads, resolving working directory differences
func GetUploadsDir() string {
	if fi, err := os.Stat("./BackEnd"); err == nil && fi.IsDir() {
		_ = os.MkdirAll("./BackEnd/uploads", 0755)
		return "./BackEnd/uploads"
	}
	_ = os.MkdirAll("./uploads", 0755)
	return "./uploads"
}
