# Connecting front-end to coworker backend (`internship_db`)

## Current mode (default)

`environment.development.ts` has **`useMockData: true`**.

The app runs fully in the browser with demo data shaped like your MySQL tables. No backend required.

## When the backend is ready

1. Ask your coworker for:
   - Base URL (e.g. `http://localhost:3000` or `https://staging.example.com`)
   - Whether routes use `/api/...` (this project expects that prefix)
   - Login endpoint shape (default: `POST /api/auth/login` → `{ "user": { ... } }`)

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
    "target": "http://THEIR_HOST:PORT",
    "secure": false,
    "changeOrigin": true
  }
}
```

4. Run: `npm start` (proxy forwards `/api` to the backend).

5. For production build, set `apiUrl` to the full API URL in `environment.ts` and deploy with CORS allowed on the backend.

## Expected REST routes

| Table | GET list | POST create | PATCH |
|-------|----------|-------------|-------|
| users | `/api/users` | `/api/users` | `/api/users/:id` |
| companies | `/api/companies` | | |
| job_postings | `/api/job-postings` | `/api/job-postings` | |
| applications | `/api/applications` | `/api/applications` | `/api/applications/:id` |
| internships | `/api/internships` | `/api/internships` | |
| attendances | `/api/attendances` | `/api/attendances` | `/api/attendances/:id` |
| logbooks | `/api/logbooks` | `/api/logbooks` | `/api/logbooks/:id` |
| evaluations | `/api/evaluations` | `/api/evaluations` | |

JSON fields should use **snake_case** (see `src/app/api/api.mapper.ts`). The front-end maps them to camelCase automatically.

## Auth

- **Mock mode:** email + password checked against loaded `users`.
- **API mode:** `POST /api/auth/login` with `{ email, password }`; response must include `user` object matching the `users` table (password optional in response).
- **Register:** `POST /api/auth/register` with `{ name, email, password, role, phone?, company_name?, description?, address?, contact_email? }` — for `role: "company"`, also create a `companies` row linked via `user_id`.

Share this file with your backend teammate so paths and field names stay aligned.
