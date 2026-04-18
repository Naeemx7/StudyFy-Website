/**
 * Analytics Service
 *
 * Fetches global analytics for the current user from the backend.
 *
 * ENDPOINT: GET /users/{userId}/analytics/global
 *
 * WHAT IT RETURNS:
 * - Study streak (current + longest)
 * - Per-space stats (totalFiles, totalQuizzes, averageScore)
 * - Per-file tag/weak-tag details
 * - Individual quiz records (quizId, score, date, difficulty)
 *
 * HOW IT WORKS:
 * 1. Component calls getGlobalAnalytics()
 * 2. We get the userId from AuthService
 * 3. We call GET /api/users/{userId}/analytics/global
 * 4. We return the GlobalAnalytics object via Observable
 * 5. Component reads from it to populate dashboard stats / analytics charts
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { GlobalAnalytics, AnalyticsApiResponse } from '../models/analytics.models';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  /**
   * GET GLOBAL ANALYTICS
   *
   * Fetches all analytics for the current user.
   * Called by Dashboard (for stat cards + space progress) and Analytics page (for charts).
   *
   * ENDPOINT: GET /users/{userId}/analytics/global
   */
  getGlobalAnalytics(): Observable<GlobalAnalytics> {
    const userId = this.auth.getCurrentUserId();

    return this.http
      .get<AnalyticsApiResponse>(`${environment.apiUrl}/users/${userId}/analytics/global`)
      .pipe(
        map(response => {
          if (!response.isSuccess) {
            throw new Error(response.message || 'Failed to load analytics');
          }
          return response.data;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Normalises a score value to 0–100.
   * The backend sometimes returns scores as decimals (0.85) and sometimes as percentages (85).
   * Any value > 1 is treated as already 0–100; values ≤ 1 are multiplied by 100.
   */
  static normaliseScore(score: number): number {
    if (score == null) return 0;
    return score > 1 ? Math.round(score) : Math.round(score * 100);
  }

  private handleError = (error: HttpErrorResponse | Error): Observable<never> => {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
    }
    const message =
      error.status === 0
        ? 'Cannot connect to server'
        : (error.error?.message as string) || 'Failed to load analytics';
    return throwError(() => new Error(message));
  };
}
