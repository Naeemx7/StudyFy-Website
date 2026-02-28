/**
 * Environment Configuration
 * 
 * This file contains configuration values for the application.
 * - apiUrl: The base URL for all backend API calls
 * 
 * WHY WE USE '/api':
 * During development, we use a proxy to avoid CORS issues.
 * The proxy (configured in proxy.conf.json) forwards /api/* requests
 * to the actual backend server.
 * 
 * HOW IT WORKS:
 * - Your code calls: /api/Login
 * - Proxy forwards to: http://graduation-test.runasp.net/Login
 * - No CORS error because browser thinks it's same origin!
 */

export const environment = {
  production: false,
  
  // Use proxy path for development (avoids CORS issues)
  // The proxy forwards /api/* to the real backend
  apiUrl: '/api'
};
