/**
 * Development: proxy forwards /api → coworker backend (see proxy.conf.json).
 * Change useMockData to false once the backend is running.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
  useMockData: false
};
