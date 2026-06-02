# Running and Deploying ProgressIntern

This project has been unified into a single repository structure for ease of development and deployment.

## 🛠 Local Development

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Go](https://golang.org/) (v1.20+)
- Access to the TiDB Cloud database (credentials already in `.env`)

### 2. Start the Backend (Go)
Open a terminal in the `progressintern-backend/BackEnd` directory:
```bash
go run main.go
```
The API will be available at `http://localhost:8080/api`.

### 3. Start the Frontend (Angular)
Open another terminal in the `progressintern-front-end` directory:
```bash
npm install
npm start
```
The frontend will be available at `http://localhost:4200`.
Requests to `/api` will be proxied to `http://localhost:8080`.

---

## 🚀 Deployment to Vercel

Since the backend and frontend are now in separate directories, they should be deployed as separate entities if you are not using a monorepo tool.

### 1. Backend Deployment
Deploy the `progressintern-backend/BackEnd` directory to a platform that supports Go (e.g., Vercel, Render, or a VPS).

### 2. Frontend Deployment
Deploy the `progressintern-front-end` directory to Vercel. 
**Note:** If the backend is deployed separately, you should update the `apiUrl` in `src/environments/environment.ts` to point to your live backend URL instead of `/api`.

### 3. Database
The database is hosted on TiDB Cloud. The schema is located in `BackEnd/migrations/001_create_initial_schema.sql`. If you need to reset or migrate the database, run the SQL script against your TiDB instance.

---

## ✅ Integration Status
- [x] Unified Backend and Frontend into `progressintern-front-end`.
- [x] Configured `.env` with TiDB credentials.
- [x] Aligned API endpoints between Angular service and Go handlers.
- [x] Configured Angular proxy for local development.
- [x] Verified Vercel serverless function entry point (`api/index.go`).
