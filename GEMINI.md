# Project Instructions

## Workflow
- **Continuous GitHub Updates:** Every code modification or fix MUST be pushed to the `backend` branch of the GitHub repository immediately after verification.
- **Environment Management:** The `.env` file is used for local development but is excluded from git. Ensure `.env` is present in the execution directory.
- **Database:** Connects to TiDB Cloud. Diagnostics are added to `config/database.go` to verify connection parameters.
