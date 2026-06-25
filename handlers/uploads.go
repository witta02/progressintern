package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"
	"internship-backend/models"

	"github.com/gin-gonic/gin"
)

// UploadFileHandler Handles file uploads and returns the served file URL path wrapped in APIResponse
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

	// Create uploads directory if not exists
	uploadDir := GetUploadsDir()

	// Generate unique file name
	originalName := filepath.Base(file.Filename)
	uniqueName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), originalName)
	targetPath := filepath.Join(uploadDir, uniqueName)

	// Save the file
	if err := c.SaveUploadedFile(file, targetPath); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้",
			Error:   fmt.Sprintf("ล้มเหลวในการบันทึกไฟล์: %v", err),
		})
		return
	}

	// Serve URL path
	filePathUrl := fmt.Sprintf("/api/uploads/%s", uniqueName)

	c.JSON(http.StatusOK, models.APIResponse{
		Status:  http.StatusOK,
		Message: "อัปโหลดไฟล์สำเร็จ",
		Data: gin.H{
			"file_path": filePathUrl,
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
