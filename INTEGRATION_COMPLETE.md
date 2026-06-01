# Frontend Backend Integration Status

## Status: needs deployed backend URL

The frontend now builds with the checked-in auth guard and its API client is aligned with the current Go backend routes where those routes exist.

Important remaining deployment work:

- Set `src/environments/environment.ts` to `useMockData: false` only after the backend is deployed and `apiUrl` points at that backend, for example `https://your-backend.example.com/api`.
- The Go backend must be deployed as a backend service. Vercel static frontend hosting will not automatically run the `backend` branch at `/api`.
- Add backend environment variables in the backend host: `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`, and `JWT_SECRET`.
- Remove real secrets from `BackEnd/.env` in GitHub and rotate those credentials.

## Current backend route match

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/jobs`
- `POST /api/applications`
- `PUT /api/applications/:id/status`
- `POST /api/attendance/check-in`
- `PUT /api/attendance/check-out`
- `POST /api/logbooks`
- `PUT /api/logbooks/:id/approve`

The frontend still contains mock mode for local/demo use.
