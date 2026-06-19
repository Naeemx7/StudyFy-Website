/**
 * AI Service
 *
 * Handles all WorkspaceAI endpoints:
 * - POST /summary       - Generate summary from uploaded files
 * - POST /flashcards    - Generate flashcards for study
 * - POST /quiz          - Generate a quiz from file content
 * - POST /quiz-submission - Submit quiz answers and get score
 * - POST /tags-quiz     - Generate quiz from topic tags
 * - GET /storage/auto-summarize - Auto-summarize a single file
 * - POST /share         - Create shareable link for content
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
  TagsQuizRequest,
  ShareRequest,
  ShareResponse,
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

    console.log('📝 Generating quiz with:', { spaceId, filesId, difficulty, numberOfQuestions, body });

    return this.http.post<ApiResponse<QuizResponse>>(
      `${this.getBasePath(spaceId)}/quiz`,
      body
    ).pipe(
      map(response => {
        console.log('✅ Quiz response:', response);
        if (!response.isSuccess) {
          throw new Error(this.extractApiMessage(response) || 'Failed to generate quiz');
        }

        if (!response.data?.operationResponse || response.data.operationResponse.responseContent == null) {
          throw new Error(this.extractApiMessage(response) || 'Quiz generation returned no content. Please try again.');
        }

        return response.data;
      }),
      catchError(err => {
        console.error('❌ Quiz generation error:', err);
        return this.handleError(err);
      })
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
   * GENERATE TAGS QUIZ
   *
   * Generates a quiz targeting specific topic tags rather than
   * full file content. Useful for retesting weak areas.
   *
   * ENDPOINT: POST /tags-quiz
   */
  generateTagsQuiz(
    spaceId: string,
    tags: string[],
    difficulty: DifficultyLevel = 'Medium',
    numberOfQuestions: number = 5
  ): Observable<QuizResponse> {
    const body: TagsQuizRequest = {
      tags,
      difficultyLevel: difficulty,
      numberOfQuestions: Math.max(1, Math.min(30, numberOfQuestions)),
    };

    return this.http.post<ApiResponse<QuizResponse>>(
      `${this.getBasePath(spaceId)}/tags-quiz`,
      body
    ).pipe(
      map(res => res.data),
      catchError(this.handleError)
    );
  }

  /**
   * AUTO-SUMMARIZE SINGLE FILE
   *
   * Automatically summarize a single file on load without AI processing.
   * This is a quick summary generation using the file's extracted text.
   *
   * ENDPOINT: GET /storage/auto-summarize
   */
  autoSummarizeFile(spaceId: string, fileName: string): Observable<GeminiResponse> {
    return this.http.get<ApiResponse<GeminiResponse>>(
      `${this.getBasePath(spaceId)}/storage/auto-summarize`,
      { params: { fileName } }
    ).pipe(
      map(response => {
        if (!response.isSuccess) {
          throw new Error(response.message || 'Failed to auto-summarize file');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * SHARE CONTENT
   *
   * Creates a shareable public link for quiz results, summaries, or flashcards.
   * The shared content can be viewed by anyone with the link (no auth needed).
   *
   * ENDPOINT: POST /share
   */
  shareContent(spaceId: string, cacheKey: string, title: string, contentType: string, fallbackJson?: string): Observable<ShareResponse> {
    const body: ShareRequest = {
      cacheKey,
      title,
      contentType,
      fallbackJson
    };

    console.log('🔗 Sharing content:', { cacheKey, title, contentType });

    return this.http.post<ApiResponse<ShareResponse>>(
      `${this.getBasePath(spaceId)}/share`,
      body
    ).pipe(
      map(response => {
        if (!response.isSuccess) {
          throw new Error(response.message || 'Failed to share content');
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
      console.error('❌ 400 error details:', { error: error.error, message: error.error?.message, errors: error.error?.errors });
      
      // Provide more specific error messages
      if (error.error?.errors?.length > 0) {
        message = error.error.errors.join(' | ');
      } else if (error.error?.message) {
        message = error.error.message;
      } else {
        message = 'Invalid request - please check your input';
      }
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

  /**
   * GET SHARED CONTENT
   *
   * Retrieves shared content by ID (public endpoint, no auth required).
   * Allows anyone with the link to view shared summaries, flashcards, or quiz results.
   *
   * ENDPOINT: GET /shared/{id}
   */
  getSharedContent(id: string): Observable<any> {
    console.log('📂 Fetching shared content:', id);

    return this.http.get<ApiResponse<any>>(
      `${environment.apiUrl}/shared/${id}`
    ).pipe(
      map(response => {
        console.log('✅ Shared content received:', response);
        if (!response.isSuccess) {
          throw new Error(response.message || 'Failed to load shared content');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

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
