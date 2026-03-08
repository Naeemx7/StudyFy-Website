/**
 * Production Environment Configuration
 *
 * This file is used when you build for production (ng build --configuration production).
 * Angular automatically swaps environment.ts with this file.
 *
 * For now, we use the same test URL.
 * When your backend team gives you the production URL, change it here.
 */

export const environment = {
  production: true,

  // Production API URL (update this when you have a production server)
  apiUrl: 'http://graduation-test.runasp.net',

  // Google OAuth Client ID for Sign-In
  googleClientId: '567037118498-f37caa2jpb5gbj3ce2c6uudbb511267f.apps.googleusercontent.com'
};
