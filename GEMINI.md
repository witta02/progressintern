# Project Instructions

## Workflow
- **Continuous GitHub Updates:** Every code modification or fix MUST be pushed to the `backend` branch of the GitHub repository immediately after verification.
- **Environment Management:** The `.env` file is used for local development but is excluded from git. Ensure `.env` is present in the root directory.
- **Local Development:** To run the server locally, use:
  ```bash
  go run cmd/server/main.go
  ```
- **Vercel Deployment:** The project is configured for Vercel using `api/index.go` and `vercel.json`.
- **Database:** Connects to TiDB Cloud. Diagnostics are added to `config/database.go` to verify connection parameters.
