/**
 * Authentication Interceptor
 * 
 * WHAT IS AN INTERCEPTOR?
 * Think of it as a "security checkpoint" that every HTTP request must pass through.
 * Before any request leaves your app, this interceptor can modify it.
 * 
 * WHAT THIS INTERCEPTOR DOES:
 * 1. Checks if there's a JWT token stored (meaning user is logged in)
 * 2. If yes, adds "Authorization: Bearer {token}" header to the request
 * 3. The backend checks this header to verify you're allowed to access data
 * 
 * WHY THIS IS USEFUL:
 * Without this, you'd have to manually add the token to EVERY API call.
 * With this, it happens automatically for all requests.
 * 
 * EXAMPLE:
 * Your code:        http.get('/users/123/spaces')
 * After interceptor: http.get('/users/123/spaces', { headers: { Authorization: 'Bearer xyz...' } })
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Functional HTTP Interceptor (Angular 18+ style)
 * 
 * Angular has two styles of interceptors:
 * - Class-based (old way)
 * - Functional (new way, recommended)
 * 
 * We use the functional style because it's simpler and works with standalone components.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  
  // Get the JWT token from localStorage
  // This is where we stored it after login
  const token = localStorage.getItem('asc_jwt_token');
  
  // Skip auth header for external URLs (e.g., Azure Blob Storage uses SAS tokens in URL)
  const isExternalRequest = req.url.startsWith('https://') || req.url.startsWith('http://');
  
  // If we have a token, add it to the request header (only for our backend API)
  if (token && !isExternalRequest) {
    // Clone the request and add the Authorization header
    // We clone because HttpRequest is immutable (cannot be changed directly)
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  // Send the request and handle the response
  return next(req).pipe(
    // Catch any errors that come back
    catchError((error: HttpErrorResponse) => {
      
      // If we get 401 (Unauthorized), the token is invalid or expired
      if (error.status === 401) {
        // Clear stored auth data
        localStorage.removeItem('asc_jwt_token');
        localStorage.removeItem('asc_auth_user');
        
        // Redirect to login page
        router.navigate(['/login']);
      }
      
      // Re-throw the error so the component can also handle it
      return throwError(() => error);
    })
  );
};
