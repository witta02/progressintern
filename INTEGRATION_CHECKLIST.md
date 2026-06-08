# ✅ Pre-Integration Checklist & Recommendations

จำนวนงานที่ต้องทำก่อนการปะสานกับ Angular frontend

---

## 🚨 CRITICAL (ต้องแก้ตั้งแต่เดี๋ยว)

### 1. ✅ Authorization Middleware
- [x] JWT validation middleware สร้างแล้ว (`middleware/auth.go`)
- [x] RBAC middleware สร้างแล้ว
- [ ] **TODO**: Update all protected routes ใน `main.go` ให้ใช้ middleware
  ```go
  // Example:
  r.POST("/api/jobs", middleware.AuthMiddleware(), middleware.RequireRole("company"), createJobHandler)
  ```

### 2. ✅ JWT Secret Management
- [x] JWT secret moved to `.env`
- [ ] **TODO**: Update `main.go` ให้ใช้ `os.Getenv("JWT_SECRET")`
  ```go
  var jwtKey = []byte(os.Getenv("JWT_SECRET"))
  ```

### 3. ❌ Input Validation Improvements
- [x] Models ที่มี validation tags สร้างแล้ว (`models/models.go`)
- [ ] **TODO**: Update all handlers ให้ใช้ models ที่ declare ใน `models.go`
  - ลบ inline struct definitions
  - ใช้ `models.RegisterInput`, `models.LoginInput`, etc.

### 4. ❌ Database Transactions
- [ ] **TODO**: Fix `updateAppStatusHandler` ให้ใช้ transaction
  ```go
  // จาก: Multiple separate queries
  // เป็น: Single transaction
  tx, _ := db.Begin()
  tx.Exec("UPDATE applications ...")
  tx.Exec("INSERT INTO internships ...")
  tx.Commit()
  ```

### 5. ❌ Error Handling Standardization
- [ ] **TODO**: Create utility function for API responses
  ```go
  func sendResponse(c *gin.Context, status int, message string, data interface{}, err error) {
      response := models.APIResponse{
          Status:  status,
          Message: message,
          Data:    data,
      }
      if err != nil {
          response.Error = err.Error()
      }
      c.JSON(status, response)
  }
  ```

---

## 🟡 HIGH PRIORITY (สำคัญมาก)

### 6. ❌ Missing User Profile Endpoints
- [ ] `GET /api/users/:id` - ดูโปรไฟล์
- [ ] `PUT /api/users/:id` - แก้ไขโปรไฟล์
- [ ] `GET /api/users/:id/resume` - ดูประวัติ

```go
func getUserProfileHandler(c *gin.Context) {
    userID := c.Param("id")
    var user models.User
    err := db.QueryRow("SELECT id, name, email, role, phone, profile_image FROM users WHERE id = ?", userID).
        Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.Phone, &user.ProfileImage)
    if err != nil {
        c.JSON(404, gin.H{"error": "User not found"})
        return
    }
    c.JSON(200, models.APIResponse{Status: 200, Message: "Success", Data: user})
}
```

### 7. ❌ Missing Search & Filter API
- [ ] `GET /api/jobs?search=keyword&location=Bangkok&category=IT&slots_min=3`
- [ ] `GET /api/applications?status=pending&company_id=1`

```go
func getJobsHandler(c *gin.Context) {
    search := c.Query("search")
    location := c.Query("location")
    category := c.Query("category")
    
    query := "SELECT ... FROM job_postings WHERE status = 'open'"
    if search != "" {
        query += " AND (title LIKE ? OR description LIKE ?)"
    }
    if location != "" {
        query += " AND location = ?"
    }
    // ... implement filtering ...
}
```

### 8. ❌ Missing Pagination
- [ ] `GET /api/jobs?page=1&limit=10`
- [ ] `GET /api/applications?page=2&limit=20`

```go
type PaginationParams struct {
    Page  int `form:"page,default=1" binding:"min=1"`
    Limit int `form:"limit,default=10" binding:"min=1,max=100"`
}

offset := (page - 1) * limit
query += fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
```

### 9. ❌ Database Connection Pooling Configuration
- [ ] Set max open connections
- [ ] Set max idle connections
- [ ] Set connection max lifetime

```go
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)
```

### 10. ❌ Evaluation System Endpoints
- [ ] `POST /api/evaluations` - Create evaluation
- [ ] `GET /api/evaluations/internship/:id` - Get all evaluations
- [ ] `PUT /api/evaluations/:id` - Update evaluation

---

## 🟢 MEDIUM PRIORITY (ควรเพิ่มในเร็วๆ นี้)

### 11. ❌ File Upload System
- [ ] Create `/uploads` directory handler
- [ ] `POST /api/files/upload` - Upload resume/document
- [ ] `GET /api/files/:id` - Download file
- [ ] File validation (size, type)

```go
func uploadFileHandler(c *gin.Context) {
    file, _ := c.FormFile("file")
    // Validate file type and size
    if file.Size > 10*1024*1024 { // 10MB limit
        c.JSON(400, gin.H{"error": "File too large"})
        return
    }
    
    filename := fmt.Sprintf("uploads/%d-%s", time.Now().Unix(), file.Filename)
    c.SaveUploadedFile(file, filename)
    
    // Store in database
    db.Exec("INSERT INTO file_uploads ... VALUES (...)")
    c.JSON(201, gin.H{"message": "File uploaded", "path": filename})
}
```

### 12. ❌ Logging System
- [ ] Add structured logging (uber/zap)
- [ ] Log all API requests/responses
- [ ] Log database queries (in dev)
- [ ] Error tracking

```bash
go get go.uber.org/zap
```

### 13. ❌ Rate Limiting
- [ ] Install rate limiter package
- [ ] Limit login attempts
- [ ] Limit API calls per IP

```bash
go get github.com/ulule/limiter/v3
```

### 14. ❌ Notification System
- [ ] `POST /api/notifications` - Create notification
- [ ] `GET /api/notifications/:user_id` - Get unread notifications
- [ ] `PUT /api/notifications/:id/read` - Mark as read
- [ ] Email/SMS integration (future)

### 15. ❌ Statistics/Dashboard Endpoints
- [ ] `GET /api/stats/students-enrolled` - Total students
- [ ] `GET /api/stats/jobs-filled` - Filled positions
- [ ] `GET /api/stats/attendance-rate` - Attendance percentage
- [ ] `GET /api/stats/by-company/:id` - Company-specific stats

---

## 🔧 Code Refactoring

### Move Handlers to Separate Files
Current: Everything in `main.go` (1000+ lines)

Recommended structure:
```
handlers/
├── auth.go          (register, login)
├── jobs.go          (job CRUD)
├── applications.go  (application management)
├── attendance.go    (check-in/out)
├── logbooks.go      (logbook management)
└── evaluations.go   (evaluation system)
```

### Create Service Layer
```
services/
├── auth_service.go
├── job_service.go
├── attendance_service.go
└── email_service.go (for notifications)
```

### Create Utils Package
```
utils/
├── database.go      (DB helper functions)
├── validator.go     (custom validation)
├── jwt_helper.go    (JWT utilities)
└── response.go      (response formatting)
```

---

## 📋 Database Migration Script

Create proper migration system:
```go
// migrations/migrate.go
func RunMigrations(db *sql.DB) error {
    // Read migration files
    // Execute in order
    // Track schema version
}

// In main.go
if err := migrations.RunMigrations(db); err != nil {
    log.Fatal("Migration failed:", err)
}
```

---

## 🧪 Testing Checklist

- [ ] Test all API endpoints with Postman
- [ ] Test authentication flow
  - [ ] Register new user
  - [ ] Login (valid credentials)
  - [ ] Login (invalid credentials)
  - [ ] Use token to access protected resource
- [ ] Test role-based access
  - [ ] Student cannot create jobs
  - [ ] Company cannot submit applications
  - [ ] Non-admin cannot approve logbooks
- [ ] Test error handling
  - [ ] Missing required fields
  - [ ] Invalid token
  - [ ] Expired token
  - [ ] Database connection failure
- [ ] Load testing (100+ concurrent requests)

---

## 🔐 Security Improvements

- [ ] Implement rate limiting on login endpoint
- [ ] Add request validation on all inputs
- [ ] Sanitize database queries (already done ✓)
- [ ] Add HTTPS in production
- [ ] Implement CSRF protection
- [ ] Add API key for service-to-service calls
- [ ] Implement request signing

---

## 📚 Documentation

- [x] Create README.md
- [x] Create SYSTEM_REVIEW.md
- [x] Create ANGULAR_INTEGRATION_GUIDE.md
- [ ] Generate Swagger/OpenAPI docs
- [ ] Create API reference document
- [ ] Create database schema diagram
- [ ] Create architecture diagram

---

## 🚀 Pre-Integration Validation

Before giving to Angular team, verify:

- [ ] All middleware functions in `middleware/auth.go` work correctly
- [ ] Models with validation tags in `models/models.go` are complete
- [ ] Database connection maintains 24/7
- [ ] JWT tokens generate correctly
- [ ] Token validation rejects invalid tokens
- [ ] Role checking prevents unauthorized access
- [ ] CORS allows Angular requests
- [ ] All endpoints return standardized response format
- [ ] Error messages are clear and helpful
- [ ] Database schema matches models

---

## 📊 Implementation Priority by Phase

### Phase 1 (CRITICAL - Do Now)
1. Add middleware to all protected routes
2. Update auth to use os.Getenv("JWT_SECRET")
3. Standardize error responses
4. Add input validation to all handlers
5. Test all endpoints

**Estimated Time**: 4-6 hours

### Phase 2 (High Priority - Do Before Full Integration)
6. User profile endpoints
7. Search & filter APIs
8. Pagination
9. Database transaction fix
10. File upload system

**Estimated Time**: 2-3 days

### Phase 3 (Follow-up - Can do after Integration)
11. Logging system
12. Notification system
13. Evaluation system
14. Statistics endpoints
15. Rate limiting
16. Code refactoring into services

**Estimated Time**: 1 week

---

## ✨ Final Checklist Before Handoff

```
CORE FUNCTIONALITY:
- [ ] Authentication (register/login) works
- [ ] JWT token generation works
- [ ] JWT token validation works
- [ ] All API endpoints callable
- [ ] Database queries working

SECURITY:
- [ ] Password hashing (bcrypt) working
- [ ] Protected routes require valid token
- [ ] RBAC (role checking) working
- [ ] SQL injection prevention verified
- [ ] CORS configured correctly

INTEGRATION:
- [ ] API base URL configurable via environment
- [ ] Error responses follow standard format
- [ ] Response times < 200ms for most endpoints
- [ ] No hardcoded credentials in code
- [ ] .env template provided

DOCUMENTATION:
- [ ] README with setup instructions
- [ ] API integration guide for Angular
- [ ] Database schema documented
- [ ] Middleware usage documented

TESTING:
- [ ] All endpoints tested in Postman
- [ ] Error cases tested
- [ ] Database connection tested
- [ ] Token validation tested
```

---

## 🎯 Next Steps

1. **This Week**:
   - Implement critical security fixes
   - Add user profile endpoints
   - Add search/filter to jobs

2. **Next Week**:
   - Add pagination
   - Implement file uploads
   - Start logging system

3. **Integration Week**:
   - Coordinate with Angular team
   - Do joint testing
   - Document API in Swagger

---

## 📞 Contact & Support

- Backend Ready for Review: **2026-06-01**
- Contact: Backend Development Team
- Status: ✅ Ready for Integration (with notes above)

---

**Last Updated**: 2026-06-01
**Version**: 1.0.0-beta
**Status**: 🟡 Ready for Integration (with Phase 1 critical fixes)
