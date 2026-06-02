# Progress Intern

Internship management app with an Angular frontend and a Go/Gin API backend.

## Frontend

```bash
npm install
npm run build
npm start
```

The Angular app uses `/api` as its backend base URL.

## Backend

Set these environment variables before running the API:

```bash
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=4000
DB_NAME=
JWT_SECRET=
```

Run locally:

```bash
go run ./BackEnd
```

The local API listens on `PORT` or `8080` by default.

## Vercel

This branch includes `vercel.json` and `api/index.go` so Vercel can route `/api/*` requests to the Go API handler while building the Angular app.
