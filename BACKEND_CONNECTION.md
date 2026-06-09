# Connecting front-end to coworker backend (`internship_db`)

## Current mode (default)

`environment.development.ts` has **`useMockData: faluse`**.

The app runs fully in the browser with demo data shaped like your MySQL tables. No backend required.

## When the backend is ready

1. Ask your coworker for:
   - Base URL (e.g. `http://localhost:8080` or `https://staging.example.com`)
   - Whether routes use `/api/...` (this project expects that prefix)
   - Login endpoint shape. The current Go backend returns `{ "id": 1, "name": "...", "email": "...", "role": "...", "token": "..." }`

2. Edit **`src/environments/environment.development.ts`**:

```ts
export const environment = {
  production: false,
  apiUrl: '/api',
  useMockData: false   // ← switch to live API
};
```

3. Edit **`proxy.conf.json`** — set `target` to their server:

```json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true
  }
}
```

4. Run: `npm start` (proxy forwards `/api` to the backend).

5. For production build, set `apiUrl` to the full API URL in `environment.ts` and deploy with CORS allowed on the backend.

## Expected REST routes

| Area | Backend route |
|------|---------------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login` |
| Jobs | `GET /api/jobs`, `POST /api/jobs` |
| Applications | `POST /api/applications`, `GET /api/applications/company/:id`, `PUT /api/applications/:id/status` |
| Attendance | `POST /api/attendance/check-in`, `PUT /api/attendance/check-out` |
| Logbooks | `POST /api/logbooks`, `PUT /api/logbooks/:id/approve` |

JSON fields should use **snake_case** (see `src/app/api/api.mapper.ts`). The front-end maps them to camelCase automatically.

## Auth

- **Mock mode:** email + password checked against loaded `users`.
- **API mode:** `POST /api/auth/login` with `{ email, password }`; response must include user fields and a `token`.
- **Register:** `POST /api/auth/register` with `{ name, email, password, role, phone?, company_name?, description?, address?, contact_email? }` — for `role: "company"`, also create a `companies` row linked via `user_id`.

Share this file with your backend teammate so paths and field names stay aligned.
