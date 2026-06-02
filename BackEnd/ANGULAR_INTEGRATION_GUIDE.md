# 🔌 Internship Backend API - Angular Integration Guide

## 📋 ข้อมูลทั่วไป

- **Backend URL**: `http://localhost:8080` (development) หรือ `https://api.yourdomain.com` (production)
- **Database**: TiDB Cloud
- **Authentication**: JWT Token in Authorization header
- **CORS**: Enabled for all origins (⚠️ ควรจำกัดใน production)

---

## 🔐 Authentication Flow

### 1. Registration (สมัครสมาชิก)
```
POST /api/auth/register
Content-Type: application/json

{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePassword123",
    "role": "student",  // student, company, advisor, admin
    "phone": "0812345678"
}

Response: 201 Created
{
    "status": 201,
    "message": "สมัครสมาชิกสำเร็จ"
}
```

### 2. Login (เข้าสู่ระบบ)
```
POST /api/auth/login
Content-Type: application/json

{
    "email": "john@example.com",
    "password": "SecurePassword123"
}

Response: 200 OK
{
    "status": 200,
    "message": "Login successful",
    "data": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "role": "student",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
}
```

### 3. Store Token in Angular

```typescript
// auth.service.ts
export class AuthService {
  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<any>('http://localhost:8080/api/auth/login', 
      { email, password })
      .pipe(
        tap(response => {
          // บันทึก token ลง localStorage
          localStorage.setItem('auth_token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data));
        })
      );
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
```

### 4. HTTP Interceptor (ส่ง Token ในทุก request)

```typescript
// auth.interceptor.ts
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    
    if (token) {
      // เพิ่ม JWT token ใน Authorization header
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Token หมดอายุ - redirect to login
          this.authService.logout();
          window.location.href = '/login';
        }
        return throwError(error);
      })
    );
  }
}

// app.module.ts
@NgModule({
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
export class AppModule { }
```

---

## 💼 Job Management APIs

### 1. Get All Jobs (ดูงานทั้งหมด)
```
GET /api/jobs

Response: 200 OK
{
    "status": 200,
    "message": "Jobs retrieved",
    "data": [
        {
            "id": 1,
            "company_id": 1,
            "title": "Frontend Developer",
            "description": "...",
            "slots": 3,
            "status": "open"
        }
    ]
}
```

### 2. Create Job (บริษัทลงประกาศ)
```
POST /api/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
    "title": "React Developer",
    "description": "Looking for experienced React developer",
    "requirements": "3+ years experience",
    "benefits": "Competitive salary, health insurance",
    "slots": 5,
    "location": "Bangkok",
    "category": "IT"
}

Response: 201 Created
```

### 3. Apply Job (นักศึกษาสมัครงาน)
```
POST /api/applications
Authorization: Bearer <token>
Content-Type: application/json

{
    "student_id": 1,
    "job_posting_id": 1,
    "cover_letter": "I am interested..."
}

Response: 201 Created
{
    "status": 201,
    "message": "ส่งใบสมัครเรียบร้อยแล้ว รอการพิจารณา"
}
```

---

## 📝 Logbook APIs

### 1. Submit Logbook (นักศึกษาส่งรายงานประจำวัน)
```
POST /api/logbooks
Authorization: Bearer <token>
Content-Type: application/json

{
    "internship_id": 1,
    "student_id": 1,
    "title": "Day 1 - Onboarding",
    "content": "Today I learned about company processes...",
    "week_number": 1
}

Response: 201 Created
```

### 2. Approve Logbook (พี่เลี้ยงอนุมัติ)
```
PUT /api/logbooks/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

{
    "status": "approved",  // approved or rejected
    "comment": "Good work!"
}

Response: 200 OK
```

---

## 📍 Attendance APIs

### 1. Check In (เช็คอินเข้างาน)
```
POST /api/attendance/check-in
Authorization: Bearer <token>
Content-Type: application/json

{
    "internship_id": 1,
    "student_id": 1,
    "latitude": 13.7563,
    "longitude": 100.5018
}

Response: 201 Created
{
    "status": 201,
    "message": "เช็คอินเข้างานเรียบร้อย"
}
```

### 2. Check Out (เช็คเอาท์เลิกงาน)
```
PUT /api/attendance/check-out
Authorization: Bearer <token>
Content-Type: application/json

{
    "internship_id": 1,
    "student_id": 1
}

Response: 200 OK
{
    "status": 200,
    "message": "เช็คเอาท์เลิกงานเรียบร้อย"
}
```

---

## 🔄 Company-Related APIs

### 1. Get Applications (บริษัทดูคนสมัคร)
```
GET /api/applications/company/:id
Authorization: Bearer <token>

Response: 200 OK
{
    "status": 200,
    "data": [
        {
            "application_id": 1,
            "student_name": "John Doe",
            "student_email": "john@example.com",
            "job_title": "Frontend Developer",
            "status": "pending"
        }
    ]
}
```

### 2. Update Application Status (บริษัทตัดสินใจสมัคร)
```
PUT /api/applications/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
    "status": "approved"  // pending, interview, approved, rejected
}

Response: 200 OK
{
    "status": 200,
    "message": "ปรับเปลี่ยนสถานะใบสมัครเรียบร้อย"
}
```

---

## ⚙️ Environment Configuration (Angular)

### environment.ts
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080'
};
```

### environment.prod.ts
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.yourdomain.com'
};
```

### app.module.ts
```typescript
import { environment } from './environments/environment';

@NgModule({
  providers: [
    {
      provide: 'API_URL',
      useValue: environment.apiUrl
    }
  ]
})
export class AppModule { }
```

---

## 🛡️ Error Handling

```typescript
// error.interceptor.ts
export class ErrorInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Unknown error occurred';
        
        if (error.error instanceof ErrorEvent) {
          errorMessage = `Client Error: ${error.error.message}`;
        } else {
          errorMessage = `Server Error: ${error.status} - ${error.error?.error || error.message}`;
        }

        console.error(errorMessage);
        return throwError(() => error);
      })
    );
  }
}
```

---

## 📊 Response Format Standard

ทุก API response ลงท้ายด้วย:
```json
{
    "status": 200,          // HTTP status code
    "message": "Success",   // Message
    "data": {...},         // Actual data (optional)
    "error": null          // Error message (optional)
}
```

---

## 🔗 API Base URL Setup in Services

```typescript
// job.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private apiUrl = `${environment.apiUrl}/api/jobs`;

  constructor(private http: HttpClient) { }

  getAll() {
    return this.http.get<any>(this.apiUrl);
  }

  create(job: any) {
    return this.http.post<any>(this.apiUrl, job);
  }

  apply(application: any) {
    return this.http.post<any>(`${environment.apiUrl}/api/applications`, application);
  }
}
```

---

## ✅ Checklist ก่อนส่งคืนงาน

- [ ] JWT token ถูก store ใน localStorage
- [ ] Authorization header ถูก attach ใน every request
- [ ] 401 errors trigger redirect to login
- [ ] Error messages display ให้ user
- [ ] CORS configuration ถูก set ที่ backend
- [ ] API_URL environment เปลี่ยน production ได้
- [ ] All endpoints tested ใน Postman/Insomnia
- [ ] User roles (student, company, advisor, admin) ทำงานถูก
- [ ] Response parsing ทำงาน correct
- [ ] Loading states แสดง correctly

---

## 🚀 Testing with Postman/Insomnia

1. Import collection: [Generate from Swagger once available]
2. Set environment variable: `{{base_url}}` = `http://localhost:8080`
3. First request: POST /api/auth/login → copy token
4. In Postman: Set Authorization type = "Bearer Token" → paste token
5. All subsequent requests จะ auto-include token

---

## 📞 ติดต่อ Backend Developer

- Status: ✅ Development
- Last Updated: 2026-06-01
- Issues: Report to backend team via GitHub Issues
