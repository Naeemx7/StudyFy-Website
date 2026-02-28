/**
 * Space Service
 * 
 * A "Space" is a study subject container (like a folder for a course).
 * Examples: "Operating Systems", "French A1", "Machine Learning"
 * 
 * This service handles:
 * - GET /users/{userId}/spaces - List all user's spaces
 * - POST /users/{userId}/spaces - Create a new space
 * - DELETE /users/{userId}/spaces/{workspaceId} - Delete a space
 * 
 * HOW IT WORKS:
 * 1. When dashboard loads, it calls loadSpaces()
 * 2. We fetch spaces from backend API
 * 3. We store them in a BehaviorSubject so components can subscribe
 * 4. When user creates a space, we call API + update local state
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { 
  Space, 
  SpaceResponse, 
  CreateSpaceRequest,
  mapSpaceResponseToSpace 
} from '../models/space.models';

/**
 * API Response wrapper - all backend responses use this format
 */
interface ApiResponse<T> {
  isSuccess: boolean;
  message: string;
  errors?: string[];
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class SpaceService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  // BehaviorSubject holds the current list of spaces
  // Components subscribe to spaces$ to get updates
  private spacesSubject = new BehaviorSubject<Space[]>([]);
  readonly spaces$ = this.spacesSubject.asObservable();

  // Loading state - components can show spinner while loading
  private loadingSubject = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubject.asObservable();

  // Error state
  private errorSubject = new BehaviorSubject<string>('');
  readonly error$ = this.errorSubject.asObservable();

  /**
   * GET ALL SPACES
   * 
   * Fetches all spaces for the current user from the backend.
   * Uses the userId from AuthService.
   * 
   * ENDPOINT: GET /users/{userId}/spaces
   */
  loadSpaces(): Observable<Space[]> {
    const userId = this.auth.getCurrentUserId();
    
    if (!userId) {
      this.errorSubject.next('User not logged in');
      return of([]);
    }

    this.loadingSubject.next(true);
    this.errorSubject.next('');

    return this.http.get<ApiResponse<SpaceResponse[]>>(`${environment.apiUrl}/users/${userId}/spaces`)
      .pipe(
        // Extract data from wrapped response and convert to frontend model
        map(response => {
          console.log('Load spaces response:', response);
          // Handle wrapped response {isSuccess, data: [...]}
          if (!response.isSuccess) {
            throw new Error(response.message || 'Failed to load spaces');
          }
          const spacesData = response.data;
          if (!Array.isArray(spacesData)) {
            return [];
          }
          return spacesData.map(mapSpaceResponseToSpace);
        }),
        // Update local state
        tap(spaces => {
          this.spacesSubject.next(spaces);
          this.loadingSubject.next(false);
        }),
        // Handle errors
        catchError(error => {
          this.loadingSubject.next(false);
          const message = this.getErrorMessage(error);
          this.errorSubject.next(message);
          // Return empty array so UI doesn't break
          this.spacesSubject.next([]);
          return of([]);
        })
      );
  }

  /**
   * CREATE NEW SPACE
   * 
   * Creates a new study space.
   * After successful creation, adds to local state so UI updates immediately.
   * 
   * ENDPOINT: POST /users/{userId}/spaces
   */
  createSpace(name: string, description: string): Observable<Space> {
    const userId = this.auth.getCurrentUserId();
    
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }

    const request: CreateSpaceRequest = { name, description };

    return this.http.post<ApiResponse<SpaceResponse>>(`${environment.apiUrl}/users/${userId}/spaces`, request)
      .pipe(
        // Extract data from wrapped response and convert to frontend model
        map(response => {
          console.log('Create space response:', response);
          if (!response.isSuccess) {
            throw new Error(response.message || 'Failed to create space');
          }
          return mapSpaceResponseToSpace(response.data);
        }),
        // Add to local state (optimistic update)
        tap(newSpace => {
          const currentSpaces = this.spacesSubject.value;
          // Add new space at the beginning of the list
          this.spacesSubject.next([newSpace, ...currentSpaces]);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * DELETE SPACE
   * 
   * Removes a space and all its contents.
   * 
   * ENDPOINT: DELETE /users/{userId}/spaces/{workspaceId}
   */
  deleteSpace(spaceId: string): Observable<void> {
    const userId = this.auth.getCurrentUserId();
    
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }

    return this.http.delete<void>(`${environment.apiUrl}/users/${userId}/spaces/${spaceId}`)
      .pipe(
        // Remove from local state
        tap(() => {
          const currentSpaces = this.spacesSubject.value;
          const updatedSpaces = currentSpaces.filter(s => s.id !== spaceId);
          this.spacesSubject.next(updatedSpaces);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * GET SINGLE SPACE BY ID
   * 
   * Returns a space from local state.
   * If not found locally, could fetch from API (not implemented yet).
   */
  getSpaceById(id: string): Space | undefined {
    return this.spacesSubject.value.find(s => s.id === id);
  }

  /**
   * CLEAR SPACES
   * 
   * Called on logout to clear cached data
   */
  clearSpaces(): void {
    this.spacesSubject.next([]);
    this.errorSubject.next('');
  }

  /**
   * Helper: Extract error message from HTTP error
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Cannot connect to server';
    }
    if (error.status === 401) {
      return 'Session expired. Please log in again.';
    }
    if (error.status === 404) {
      return 'Spaces not found';
    }
    return error.error?.message || 'Failed to load spaces';
  }

  /**
   * Error handler for create/delete operations
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let message = 'An error occurred';
    
    if (error.status === 0) {
      message = 'Cannot connect to server';
    } else if (error.status === 400) {
      message = error.error?.message || 'Invalid data';
    } else if (error.status === 401) {
      message = 'Session expired';
    } else if (error.error?.message) {
      message = error.error.message;
    }
    
    return throwError(() => new Error(message));
  };
}
