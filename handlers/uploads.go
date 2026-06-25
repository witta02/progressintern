package handlers

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
	"internship-backend/models"

	"github.com/gin-gonic/gin"
)

// UploadFileHandler handles uploads by forwarding the file to catbox.moe for cloud storage
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

	// Forward file to catbox.moe
	bodyBuf := &bytes.Buffer{}
	bodyWriter := multipart.NewWriter(bodyBuf)

	// Add reqtype=fileupload
	_ = bodyWriter.WriteField("reqtype", "fileupload")

	// Add fileToUpload
	fileWriter, err := bodyWriter.CreateFormFile("fileToUpload", file.Filename)
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

	req, err := http.NewRequest("POST", "https://catbox.moe/user/api.php", bodyBuf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Status:  http.StatusInternalServerError,
			Message: "ไม่สามารถอัปโหลดไฟล์ได้",
			Error:   err.Error(),
		})
		return
	}
	req.Header.Set("Content-Type", bodyWriter.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}
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

	// catbox.moe returns the plain-text URL of the uploaded file directly
	fileUrl := string(respBody)

	c.JSON(http.StatusOK, models.APIResponse{
		Status:  http.StatusOK,
		Message: "อัปโหลดไฟล์สำเร็จ (Cloud)",
		Data: gin.H{
			"file_path": fileUrl,
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
