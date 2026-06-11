# Frontend Project Instructions

## Workflow
- **Continuous GitHub Updates:** Every code modification or fix MUST be pushed to the `frontend` branch of the GitHub repository immediately after verification.
- **Production Branch:** The Vercel project is configured to use the `frontend` branch for production deployments.
- **Deployment:** To deploy the latest changes to production, use:
  ```bash
  vercel --prod
  ```
- **Local Development:**
  ```bash
  npm install
  npm start
  ```
  The app will be available at `http://localhost:4200`.

## Integration
- **Backend Connection:** The frontend connects to the backend API as configured in `src/environments/environment.ts`.
- **Vercel Rewrites:** `vercel.json` contains rewrites to proxy `/api` requests to the backend.
