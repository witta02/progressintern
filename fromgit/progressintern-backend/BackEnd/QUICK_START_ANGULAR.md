# 🚀 Quick Start - Backend Integration

ไฟล์นี้สำหรับ Angular team ที่จะรวมกับ Backend

---

## ⚡ 5 นาที Setup

1. **Backend Base URL**
   ```typescript
   // environment.ts
   export const environment = {
     apiUrl: 'http://localhost:8080'
   };
   ```

2. **Create Auth Service**
   ```typescript
   // services/auth.service.ts
   login(email: string, password: string) {
     return this.http.post<any>(`${environment.apiUrl}/api/auth/login`, 
       { email, password })
       .pipe(
         tap(response => {
           localStorage.setItem('auth_token', response.data.token);
         })
       );
   }
   ```

3. **Create HTTP Interceptor**
   ```typescript
   // interceptors/auth.interceptor.ts
   intercept(req: HttpRequest<any>, next: HttpHandler) {
     const token = localStorage.getItem('auth_token');
     if (token) {
       req = req.clone({
         setHeaders: { Authorization: `Bearer ${token}` }
       });
     }
     return next.handle(req);
   }
   ```

4. **Register Interceptor**
   ```typescript
   // app.module.ts
   providers: [
     { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
   ]
   ```

5. **Test Login**
   ```typescript
   // component
   this.authService.login('user@email.com', 'password').subscribe(
     (response) => { console.log('Logged in!', response.data); }
   );
   ```

---

## 🔗 Main API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
```

### Jobs
```
GET /api/jobs
POST /api/jobs (company only)
```

### Applications
```
POST /api/applications (student)
GET /api/applications/company/:id (company)
PUT /api/applications/:id/status (company)
```

### Attendance
```
POST /api/attendance/check-in
PUT /api/attendance/check-out
```

### Logbook
```
POST /api/logbooks
PUT /api/logbooks/:id/approve
```

---

## 📌 Important Notes

- All responses follow this format:
  ```json
  { "status": 200, "message": "Success", "data": {...} }
  ```

- Protected endpoints require: `Authorization: Bearer <token>`

- Token expires after 24 hours → redirect to login on 401

- For detailed API docs: See `ANGULAR_INTEGRATION_GUIDE.md`

---

## 🧪 Test with Postman First

1. Register: `POST /api/auth/register`
   ```json
   {
     "name": "Test User",
     "email": "test@email.com",
     "password": "TestPass123",
     "role": "student",
     "phone": "0812345678"
   }
   ```

2. Login: `POST /api/auth/login`
   ```json
   {
     "email": "test@email.com",
     "password": "TestPass123"
   }
   ```
   → Copy token from response

3. Get Jobs: `GET /api/jobs`
   - Header: `Authorization: Bearer <token>`

---

## ⚙️ Backend Server

```bash
# Terminal
cd d:\BackEnd
go run main.go

# Output: 🚀 API Server รันพร้อมใช้งาน :8080
```

---

**Ready to integrate! 🎉**

For full documentation, see:
- `README.md` - Setup & overview
- `ANGULAR_INTEGRATION_GUIDE.md` - Complete API reference
- `SYSTEM_REVIEW.md` - Architecture & recommendations
