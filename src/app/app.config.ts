import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

/**
 * Application Configuration
 * 
 * This is where we configure Angular's core services (providers).
 * 
 * WHAT'S NEW:
 * - provideHttpClient(): Enables HttpClient service for making API calls
 * - withInterceptors([authInterceptor]): Registers our auth interceptor
 *   so it runs on every HTTP request
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    
    // Enable HTTP calls with our auth interceptor
    // The interceptor automatically adds JWT token to all requests
    provideHttpClient(
      withInterceptors([authInterceptor])
    )
  ]
};
