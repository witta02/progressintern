# Project Instructions

## Workflow
- **Continuous GitHub Updates:** Every code modification or fix MUST be pushed to the `backend` branch of the GitHub repository immediately after verification.
- **Environment Management:** The `.env` file is used for local development but is excluded from git. Ensure `.env` is present in the root directory.
- **Local Development:** To run the server locally, use:
  ```bash
  go run main.go
  ```
  The server will use port 8080 by default locally.
- **Vercel Deployment:** The project is configured as a Go web server. It MUST listen on the port provided by the `PORT` environment variable (managed automatically in `main.go`).
- **Database:** Connects to TiDB Cloud. Diagnostics are added to `config/database.go` to verify connection parameters.
