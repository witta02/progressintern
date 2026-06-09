/**
 * Production / default settings.
 * Set useMockData to false and apiUrl when the backend is deployed.
 */
export const environment = {
  production: true,
  /** Base URL for REST API (no trailing slash). Example: https://api.example.com/api */
  apiUrl: '/api',
  /** When true, data stays in browser memory + localStorage (no HTTP). */
  useMockData: false
};
