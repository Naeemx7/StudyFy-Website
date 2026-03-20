/**
 * AI Service
 *
 * Handles all WorkspaceAI endpoints:
 * - POST /summary       - Generate summary from uploaded files
 * - POST /flashcards    - Generate flashcards for study
 * - POST /quiz          - Generate a quiz from file content
 * - POST /quiz-submission - Submit quiz answers and get score
 *
 * HOW IT WORKS:
 * 1. User uploads files via StorageService (gets fileIds)
 * 2. User clicks "Summarize" / "Flashcards" / "Quiz" in Workspace
 * 3. This service sends fileIds to the backend AI endpoints
 * 4. Backend processes with Gemini AI and returns results
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  SummaryRequest,
  FlashcardsRequest,
  QuizRequest,
  QuizSubmissionRequest,
  ApiResponse,
  GeminiResponse,
  QuizResponse,
  QuizSubmissionResponse,
  DifficultyLevel,
} from '../models/ai.models';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private getBasePath(spaceId: string): string {
    const userId = this.auth.getCurrentUserId();
    return `${environment.apiUrl}/users/${userId}/spaces/${spaceId}`;
  }

  /**
   * GENERATE SUMMARY
   *
   * Sends file IDs to backend, which extracts content and
   * generates an AI summary using Gemini.
   *
   * ENDPOINT: POST /summary
   */
  generateSummary(spaceId: string, filesId: string[]): Observable<GeminiResponse> {
    const body: SummaryRequest = { filesId };

    return this.http.post<ApiResponse<GeminiResponse>>(
      `${this.getBasePath(spaceId)}/summary`,
      body
    ).pipe(
      map(response => {
        if (!response.isSuccess) {
          throw new Error(response.message || 'Failed to generate summary');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * GENERATE FLASHCARDS
   *
   * Generates flashcards from file content.
   *
   * ENDPOINT: POST /flashcards
   */
  generateFlashcards(
    spaceId: string,
    filesId: string[],
    difficulty: DifficultyLevel = 'Medium',
    numberOfQuestions: number = 10
  ): Observable<GeminiResponse> {
    const body: FlashcardsRequest = {
      filesId,
      difficultyLevel: difficulty,
      numberOfQuestions,
    };

    return this.http.post<ApiResponse<GeminiResponse>>(
      `${this.getBasePath(spaceId)}/flashcards`,
      body
    ).pipe(
      map(response => {
        if (!response.isSuccess) {
          throw new Error(response.message || 'Failed to generate flashcards');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * GENERATE QUIZ
   *
   * Generates a quiz from file content. Returns a quizId
   * that's used later for quiz-submission.
   *
   * ENDPOINT: POST /quiz
   */
  generateQuiz(
    spaceId: string,
    filesId: string[],
    difficulty: DifficultyLevel = 'Medium',
    numberOfQuestions: number = 5
  ): Observable<QuizResponse> {
    const body: QuizRequest = {
      filesId,
      difficultyLevel: difficulty,
      numberOfQuestions: Math.max(1, Math.min(30, numberOfQuestions)),
    };

    console.log('Quiz request body:', JSON.stringify(body));

    return this.http.post<ApiResponse<QuizResponse>>(
      `${this.getBasePath(spaceId)}/quiz`,
      body
    ).pipe(
      map(response => {
        if (!response.isSuccess) {
          throw new Error(this.extractApiMessage(response) || 'Failed to generate quiz');
        }

        if (!response.data?.operationResponse || response.data.operationResponse.responseContent == null) {
          throw new Error(this.extractApiMessage(response) || 'Quiz generation returned no content. Please try again.');
        }

        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * SUBMIT QUIZ
   *
   * Submits quiz answers. Backend calculates score and
   * updates mastery status if score >= 80%.
   *
   * ENDPOINT: POST /quiz-submission
   */
  submitQuiz(spaceId: string, submission: QuizSubmissionRequest): Observable<QuizSubmissionResponse> {
    return this.http.post<ApiResponse<QuizSubmissionResponse>>(
      `${this.getBasePath(spaceId)}/quiz-submission`,
      submission
    ).pipe(
      map(response => {
        if (!response.isSuccess) {
          throw new Error(response.message || 'Failed to submit quiz');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Error handler
   */
  private handleError = (error: HttpErrorResponse | Error): Observable<never> => {
    // Pass through plain Error objects (e.g., from isSuccess:false API responses)
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
    }

    let message = 'An error occurred';

    if (error.status === 0) {
      message = 'Cannot connect to server';
    } else if (error.status === 400) {
      console.error('400 error details:', error.error);
      message = error.error?.message || 'Invalid request';
    } else if (error.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error.status === 429) {
      message = error.error?.message || 'Rate limit exceeded. Please retry in a minute.';
    } else if (error.status === 500) {
      message = 'AI service is temporarily unavailable. Please try again.';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    return throwError(() => new Error(message));
  };

  private extractApiMessage<T>(response: ApiResponse<T>): string {
    if (response.message?.trim()) {
      return response.message.trim();
    }

    if (Array.isArray(response.errors) && response.errors.length > 0) {
      return response.errors.join(' | ');
    }

    return '';
  }
}
