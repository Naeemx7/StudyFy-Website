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
import { BadgeService } from './badge.service';
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
  private badgeService = inject(BadgeService);

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
          if (!response.isSuccess) {
            throw new Error(response.message || 'Failed to load spaces');
          }
          const spacesData = response.data;
          if (!Array.isArray(spacesData)) {
            return [];
          }
          const mappedSpaces = spacesData.map(mapSpaceResponseToSpace);
          return mappedSpaces;
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
          if (!response.isSuccess) {
            throw new Error(response.message || 'Failed to create space');
          }
          return mapSpaceResponseToSpace(response.data);
        }),

        // Add to local state (optimistic update)
        tap(newSpace => {
          const currentSpaces = this.spacesSubject.value;
          this.spacesSubject.next([newSpace, ...currentSpaces]);
          this.badgeService.trackAction('WORKSPACE_CREATED');
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
   * RESPONSE: { isSuccess: boolean, message: string, errors: string[] }
   */
  deleteSpace(spaceId: string): Observable<void> {
    const userId = this.auth.getCurrentUserId();
    
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }

    const url = `${environment.apiUrl}/users/${userId}/spaces/${spaceId}`;

    return this.http.delete<ApiResponse<void>>(url)
      .pipe(
        map(response => {
          if (!response.isSuccess) {

            // Check for known backend bug: container doesn't exist
            if (response.message?.includes('ContainerNotFound') || 
                response.message?.includes('container does not exist')) {
              throw new Error('This space cannot be deleted right now. Please contact support or try again later.');
            }
            throw new Error(response.message || 'Failed to delete space');
          }
          // Return void on success
          return;
        }),
        // Remove from local state only after API confirms success
        tap(() => {
          const currentSpaces = this.spacesSubject.value;
          const updatedSpaces = currentSpaces.filter(s => s.id !== spaceId);
          this.spacesSubject.next(updatedSpaces);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Load spaces for any userId — used when we need the file uploader's workspace
   * to create an AI chat session against the correct namespace.
   */
  loadSpacesForUser(userId: string): Observable<Space[]> {
    return this.http.get<ApiResponse<SpaceResponse[]>>(`${environment.apiUrl}/users/${userId}/spaces`)
      .pipe(
        map(response => {
          if (!response.isSuccess || !Array.isArray(response.data)) return [];
          return response.data.map(mapSpaceResponseToSpace);
        }),
        catchError(() => of([]))
      );
  }

  /**
   * GET SINGLE SPACE
   *
   * Fetches a single space from the backend by ID.
   *
   * ENDPOINT: GET /users/{userId}/spaces/{workspaceId}
   */
  getSpace(spaceId: string): Observable<Space> {
    const userId = this.auth.getCurrentUserId();
    
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }

    return this.http.get<ApiResponse<SpaceResponse>>(`${environment.apiUrl}/users/${userId}/spaces/${spaceId}`)
      .pipe(
        map(response => {
          if (!response.isSuccess) {
            throw new Error(response.message || 'Failed to load space');
          }
          return mapSpaceResponseToSpace(response.data);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * GET SINGLE SPACE BY ID (from local cache)
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
