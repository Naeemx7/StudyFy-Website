/**
 * Authentication Service
 * 
 * This service handles all authentication operations:
 * - Login (POST /Login)
 * - Register/Signup (POST /Register)
 * - Logout (clear stored data)
 * - Check if user is logged in
 * - Get current user data
 * 
 * HOW IT WORKS:
 * 1. User enters credentials on login/signup page
 * 2. This service sends them to the backend API
 * 3. Backend returns user data + JWT token
 * 4. We store the token (for future API calls) and user data
 * 5. Other parts of the app can check currentUser$ to see who's logged in
 * 
 * WHAT IS A JWT TOKEN?
 * JWT = JSON Web Token. It's like a "digital ID card" that proves you're logged in.
 * Every time you make an API call, the interceptor adds this token to prove who you are.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  User, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse,
  GeneralResponse 
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Inject HttpClient to make API calls
  private http = inject(HttpClient);
  
  // Storage keys for localStorage
  private readonly USER_KEY = 'asc_auth_user';
  private readonly TOKEN_KEY = 'asc_jwt_token';
  
  // BehaviorSubject holds the current user state
  // Components can subscribe to this to get user updates
  private readonly currentUserSubject = new BehaviorSubject<User | null>(this.loadStoredUser());
  
  // Public observable that components use to get current user
  // The $ suffix is an Angular convention meaning "this is an Observable"
  readonly currentUser$ = this.currentUserSubject.asObservable();

  /**
   * LOGIN
   * 
   * Sends credentials to POST /Login endpoint
   * On success: stores user + token, updates currentUser$
   * On failure: throws error with message
   * 
   * @param userName - User's username (or email if backend accepts it)
   * @param password - User's password
   * @returns Observable<User> - The logged-in user data
   */
  login(userName: string, password: string): Observable<User> {
    const loginData: LoginRequest = { userName, password };
    
    return this.http.post<AuthResponse>(`${environment.apiUrl}/Login`, loginData)
      .pipe(
        // Check if login was successful
        map(response => {
          if (!response.isSuccess) {
            throw new Error(response.message || 'Login failed');
          }
          
          // Convert backend response to our User model
          const user: User = {
            id: response.user.id,
            userName: response.user.userName,
            email: response.user.email,
            age: response.user.age,
            isStudent: response.user.isStudent ?? true,
            target: response.user.target,
            token: response.jwtToken,
            tokenExpiration: new Date(response.jwtExpiration)
          };
          
          return user;
        }),
        // Store the user and token
        tap(user => this.storeAuthData(user)),
        // Handle errors
        catchError(this.handleError)
      );
  }

  /**
   * REGISTER (Signup)
   * 
   * Sends user data to POST /Register endpoint
   * On success: returns success response (user should then login)
   * On failure: throws error with message
   * 
   * NOTE: After registration, user typically needs to login separately.
   * The backend may send a confirmation email first.
   */
  register(data: unknown): Observable<GeneralResponse> {
    return this.http.post<GeneralResponse>(`${environment.apiUrl}/Register`, data)
      .pipe(
        map(response => {
          if (!response.isSuccess) {
            // If there are specific errors, join them
            const errorMsg = response.errors?.join(', ') || response.message || 'Registration failed';
            throw new Error(errorMsg);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * LOGOUT
   * 
   * Clears all stored authentication data
   * Resets the current user to null
   */
  logout(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUserSubject.next(null);
  }

  /**
   * CHECK IF LOGGED IN
   * 
   * Returns true if:
   * 1. We have a stored user
   * 2. We have a valid token
   * 3. The token hasn't expired
   */
  isLoggedIn(): boolean {
    const user = this.currentUserSubject.value;
    if (!user || !user.token) return false;
    
    // Check if token is expired
    const now = new Date();
    if (user.tokenExpiration && new Date(user.tokenExpiration) < now) {
      // Token expired, clean up
      this.logout();
      return false;
    }
    
    return true;
  }

  /**
   * GET CURRENT USER
   * 
   * Returns the current user synchronously (not as Observable)
   * Useful when you need the user data immediately
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * GET CURRENT USER ID
   * 
   * Convenience method to get just the user's ID
   * Many API calls need the userId in the URL
   */
  getCurrentUserId(): string | null {
    return this.currentUserSubject.value?.id ?? null;
  }

  /**
   * STORE AUTH DATA
   * 
   * Saves user and token to localStorage and updates the BehaviorSubject
   * Called after successful login
   */
  private storeAuthData(user: User): void {
    // Store token separately (interceptor reads it directly)
    localStorage.setItem(this.TOKEN_KEY, user.token);
    
    // Store full user data
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    
    // Update the BehaviorSubject so all subscribers get notified
    this.currentUserSubject.next(user);
  }

  /**
   * LOAD STORED USER
   * 
   * Called when the service initializes
   * Loads user from localStorage if they were previously logged in
   */
  private loadStoredUser(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    if (!stored) return null;
    
    try {
      const user = JSON.parse(stored) as User;
      
      // Check if token is expired
      if (user.tokenExpiration && new Date(user.tokenExpiration) < new Date()) {
        // Token expired, clean up
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.TOKEN_KEY);
        return null;
      }
      
      return user;
    } catch {
      return null;
    }
  }

  /**
   * ERROR HANDLER
   * 
   * Converts HTTP errors into user-friendly error messages
   * 
   * ASP.NET Core returns validation errors in this format:
   * { "errors": { "FieldName": ["error1", "error2"] }, "title": "...", "status": 400 }
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    // Log full error for debugging
    console.error('Full HTTP error:', error);
    console.error('Error body:', error.error);
    console.error('Error body JSON:', JSON.stringify(error.error, null, 2));
    
    let message = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error (network issues, etc.)
      message = 'Network error. Please check your connection.';
    } else if (error.status === 0) {
      // Server unreachable
      message = 'Cannot connect to server. Please try again later.';
    } else if (error.status === 400) {
      // Bad request - usually validation errors
      // Handle ASP.NET Core validation error format
      message = this.extractValidationErrors(error.error) || 'Invalid data provided';
    } else if (error.status === 401) {
      // Unauthorized
      message = 'Invalid credentials';
    } else if (error.status === 404) {
      // Not found
      message = 'User not found';
    } else if (error.error?.message) {
      // Backend provided an error message
      message = error.error.message;
    }
    
    return throwError(() => new Error(message));
  };

  /**
   * Extract validation errors from ASP.NET Core response
   * 
   * Handles multiple formats:
   * 1. { errors: { field: ["msg1", "msg2"] } } - ASP.NET validation
   * 2. { message: "error text" } - Simple message
   * 3. { errors: ["msg1", "msg2"] } - Array format (if ever used)
   * 4. "plain string error"
   */
  private extractValidationErrors(errorBody: unknown): string | null {
    if (!errorBody) return null;
    
    // If it's a string, return it directly
    if (typeof errorBody === 'string') {
      return errorBody;
    }
    
    // Cast to any for flexible checking
    const err = errorBody as Record<string, unknown>;
    
    // Check for simple message property
    if (typeof err['message'] === 'string') {
      return err['message'];
    }
    
    // Check for ASP.NET validation errors object
    if (err['errors'] && typeof err['errors'] === 'object') {
      const errors = err['errors'];
      
      // If errors is an array, join it
      if (Array.isArray(errors)) {
        return errors.join(', ');
      }
      
      // If errors is an object (ASP.NET format), extract all messages
      const allMessages: string[] = [];
      for (const fieldErrors of Object.values(errors as Record<string, unknown>)) {
        if (Array.isArray(fieldErrors)) {
          allMessages.push(...fieldErrors.map(e => String(e)));
        } else if (typeof fieldErrors === 'string') {
          allMessages.push(fieldErrors);
        }
      }
      
      if (allMessages.length > 0) {
        return allMessages.join(', ');
      }
    }
    
    // Check for title (ASP.NET problem details)
    if (typeof err['title'] === 'string') {
      return err['title'];
    }
    
    return null;
  }
}
