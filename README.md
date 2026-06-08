# 🎓 Internship Management System - Backend

ระบบบริหารจัดการการฝึกงาน สำหรับเชื่อมโยง นักศึกษา สถานประกอบการ และสถานศึกษา

---

## 📁 Project Structure

```
BackEnd/
├── .env                              # Environment variables (⚠️ ไม่ได้ commit)
├── go.mod                            # Go module dependencies
├── go.sum                            # Go module checksums
├── main.go                           # Entry point - API routes setup
│
├── middleware/
│   └── auth.go                       # 🔐 JWT & RBAC middleware
│
├── models/
│   └── models.go                     # 📦 Data structures + validation
│
├── migrations/
│   └── 001_create_initial_schema.sql # 📋 Database schema
│
├── SYSTEM_REVIEW.md                  # 📊 System analysis & recommendations
├── ANGULAR_INTEGRATION_GUIDE.md      # 🔌 Frontend integration guide
└── README.md                         # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Go 1.25.0 or higher
- TiDB Cloud account
- Basic knowledge of REST APIs

### Installation

1. **Clone/Setup Project**
```bash
cd d:\BackEnd
```

2. **Configure Environment Variables**
```bash
# Edit .env file with your TiDB credentials
DB_USER=your_username
DB_PASSWORD=your_password
DB_HOST=your_tidb_host
DB_PORT=4000
DB_NAME=internship_db
JWT_SECRET=your_secret_key
GIN_MODE=debug
```

3. **Install Dependencies**
```bash
go mod download
go mod tidy
```

4. **Setup Database Schema**
   - Run SQL from `migrations/001_create_initial_schema.sql` in TiDB Cloud
   - Or use a database client to execute the schema

5. **Run Server**
```bash
go run main.go
```

Output:
```
💖 ระบบหลังบ้านเชื่อมต่อ TiDB Cloud สำเร็จแล้ว!
🚀 API Server รันพร้อมใช้งานแล้วบนพอร์ต :8080
```

---

## 📚 Core Files Explanation

### `main.go`
- API routes definition
- Database connection setup
- Gin framework configuration
- CORS middleware

### `middleware/auth.go`
- JWT token validation (`AuthMiddleware`)
- Role-based access control (`RequireRole`)
- Ownership verification

### `models/models.go`
- Data structures for all entities
- Input validation rules (using `binding` tags)
- Database field mapping (`db` tags)

### `.env`
Security credentials - NEVER commit to git!

---

## 🔗 API Endpoints Overview

### 🔐 Authentication
```
POST   /api/auth/register      Register new user
POST   /api/auth/login         User login (returns JWT token)
```

### 💼 Job Management
```
POST   /api/jobs               Create job posting (company only)
GET    /api/jobs               Get all open jobs
POST   /api/applications       Apply for job (student)
GET    /api/applications/company/:id  Get applications (company)
PUT    /api/applications/:id/status   Update app status (company)
```

### 📍 Attendance
```
POST   /api/attendance/check-in      Check in to work
PUT    /api/attendance/check-out     Check out from work
```

### 📝 Logbook
```
POST   /api/logbooks                 Submit logbook (student)
PUT    /api/logbooks/:id/approve     Approve logbook (mentor/admin)
```

---

## 🔐 Security Features

✅ **Password Hashing**: bcrypt (10 rounds)
✅ **JWT Authentication**: 24-hour expiration
✅ **SQL Injection Prevention**: Parameterized queries
✅ **CORS Enabled**: For Angular frontend
✅ **TLS Connection**: To TiDB Cloud

---

## 📊 Database Schema

### Key Tables
- `users` - All system users (students, companies, advisors, admins)
- `companies` - Company information
- `job_postings` - Job listings
- `applications` - Job applications
- `internships` - Active internship records
- `attendances` - Daily check-in/out logs
- `logbooks` - Student daily reports
- `evaluations` - Performance ratings
- `notifications` - User notifications
- `file_uploads` - Resume/document storage
- `audit_logs` - Action log for compliance

---

## 🚦 Development Workflow

### Adding a New Endpoint

1. **Define Model** in `models/models.go`
```go
type NewInput struct {
    Field string `json:"field" binding:"required,min=3"`
}
```

2. **Add Middleware/Routes** in `main.go`
```go
r.POST("/api/endpoint", middleware.AuthMiddleware(), middleware.RequireRole("student"), handlerFunc)
```

3. **Implement Handler** in `main.go`
```go
func handlerFunc(c *gin.Context) {
    var input NewInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    // ... business logic ...
    c.JSON(200, gin.H{"message": "Success"})
}
```

4. **Test with Postman**
   - Add Authorization header: `Bearer <token>`
   - Test request/response

---

## 🔂 Common Response Format

```json
{
    "status": 200,
    "message": "Operation successful",
    "data": { /* actual data */ },
    "error": null
}
```

### Error Responses
```json
{
    "status": 401,
    "message": "Unauthorized",
    "data": null,
    "error": "Token invalid or expired"
}
```

---

## ⚠️ Important Notes

1. **JWT Secret**: Change in `.env` before production!
   ```
   JWT_SECRET=your_very_secret_key_min_32_chars
   ```

2. **CORS Configuration**: Currently allows all origins. Restrict in production:
   ```go
   c.Writer.Header().Set("Access-Control-Allow-Origin", "https://yourdomain.com")
   ```

3. **Database Connection**: Uses TLS to TiDB Cloud
   - Ensure whitelist IP in TiDB security settings
   - Connection pooling configured (default)

4. **Password Requirements**: Minimum 8 characters (enforce in frontend)

5. **Token Expiration**: 24 hours (can adjust in `main.go`)

---

## 🐛 Troubleshooting

### Error: "TiDB Connection Refused"
- Check `.env` credentials
- Verify IP whitelist in TiDB Cloud console
- Ensure TLS connection enabled

### Error: "Invalid Token"
- Token has expired (24 hours)
- User needs to login again
- Check timezone sync between client/server

### No Authorization Header Sent
- Frontend must include: `Authorization: Bearer <token>`
- Check HTTP Interceptor in Angular app

---

## 📈 Next Steps (Important for Production)

1. ✅ Add middleware authentication (DONE - see `middleware/auth.go`)
2. ⏳ Create database migration script for auto-schema setup
3. ⏳ Implement file upload system (for resumes/documents)
4. ⏳ Add Swagger/OpenAPI documentation
5. ⏳ Create additional endpoints for:
   - User profile updates
   - Evaluation system
   - Statistics/dashboard
6. ⏳ Implement rate limiting
7. ⏳ Add logging system
8. ⏳ Create integration tests

---

## 🤝 Integration with Angular Frontend

See: `ANGULAR_INTEGRATION_GUIDE.md`

Key points:
- Base URL: `http://localhost:8080` (dev) or `https://api.yourdomain.com` (prod)
- All requests must include JWT token in Authorization header
- Set up HTTP Interceptor for automatic token attachment
- Handle 401 errors by redirecting to login

---

## 📖 API Documentation

For detailed API documentation: See `ANGULAR_INTEGRATION_GUIDE.md`

To generate Swagger docs (future):
```bash
# Install swag
go install github.com/swaggo/swag/cmd/swag@latest

# Generate docs
swag init

# Access at http://localhost:8080/swagger/index.html
```

---

## 🧪 Testing Endpoints

### Using cURL
```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123",
    "role": "student",
    "phone": "0812345678"
  }'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'

# Protected endpoint (with token)
curl -X GET http://localhost:8080/api/jobs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using Postman
1. Create collection
2. Set `{{base_url}}` = `http://localhost:8080`
3. Environment variable: `{{token}}` = copied JWT from login
4. All requests: Set Authorization → Bearer Token → `{{token}}`

---

## 🎯 Production Deployment Checklist

- [ ] Change `JWT_SECRET` to strong random string
- [ ] Set `GIN_MODE=release`
- [ ] Restrict CORS origins
- [ ] Enable HTTPS/TLS
- [ ] Set up proper error logging
- [ ] Configure rate limiting
- [ ] Run load tests
- [ ] Set up database backups
- [ ] Monitor error rates
- [ ] Set up uptime monitoring
- [ ] Document API in Swagger
- [ ] Create user documentation

---

## 📞 Support & Issues

- Backend Status: ✅ Development & Testing
- Last Updated: 2026-06-01
- For issues: Contact backend development team

---

## 📄 License

Internal project - All rights reserved

---

**Happy Coding! 🚀**
