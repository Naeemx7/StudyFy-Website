/**
 * Chat Service
 *
 * Handles all Chat endpoints from the backend API:
 * - POST   /chat/sessions              - Create a new chat session
 * - GET    /chat/sessions              - List all sessions for a space
 * - POST   /chat/sessions/{id}/messages - Send message and get AI reply
 * - GET    /chat/sessions/{id}         - Load a session with all messages
 * - DELETE /chat/sessions/{id}         - Delete a session
 *
 * Chat sessions are scoped to a SPACE (workspaceId in URL path).
 * Creating a session requires filesId[] — the chat is about specific files.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  CreateChatSessionRequest,
  SendMessageRequest,
  ChatSessionDetail,
  ChatSessionListItem,
  SendMessageResponse,
} from '../models/chat.models';
import { ApiResponse } from '../models/ai.models';

/** GeneralResponse envelope used by DELETE */
interface GeneralResponse {
  isSuccess: boolean;
  message: string;
  errors?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private getBasePath(spaceId: string): string {
    const userId = this.auth.getCurrentUserId();
    return `${environment.apiUrl}/users/${userId}/spaces/${spaceId}/chat`;
  }

  // ─── 1. CREATE SESSION ────────────────────────────────

  /**
   * POST /chat/sessions
   * Body: { filesId: string[], title?: string }
   * Returns: ChatSessionDetailDto
   */
  createSession(spaceId: string, filesId: string[], title?: string): Observable<ChatSessionDetail> {
    const body: CreateChatSessionRequest = { filesId };
    if (title) {
      body.title = title;
    }

    return this.http.post<ApiResponse<ChatSessionDetail>>(
      `${this.getBasePath(spaceId)}/sessions`,
      body
    ).pipe(
      map(res => {
        if (!res.isSuccess) {
          throw new Error(res.message || 'Failed to create chat session');
        }
        return res.data;
      }),
      catchError(this.handleError)
    );
  }

  // ─── 2. LIST SESSIONS ─────────────────────────────────

  /**
   * GET /chat/sessions
   * Returns: ChatSessionListDto[]
   */
  listSessions(spaceId: string): Observable<ChatSessionListItem[]> {
    return this.http.get<ApiResponse<ChatSessionListItem[]>>(
      `${this.getBasePath(spaceId)}/sessions`
    ).pipe(
      map(res => {
        if (!res.isSuccess) {
          throw new Error(res.message || 'Failed to list chat sessions');
        }
        return res.data ?? [];
      }),
      catchError(this.handleError)
    );
  }

  /**
   * POST /chat/sessions/{sessionId}/messages
   * Body: { message: string, filesId?: string[] }
   * Returns: SendMessageResponseDto { sessionId, userMessage, assistantMessage }
   */
  sendMessage(spaceId: string, sessionId: string, message: string, filesId?: string[]): Observable<SendMessageResponse> {
    const body: SendMessageRequest = { message };
    if (filesId && filesId.length > 0) {
      body.filesId = filesId;
    }

    return this.http.post<ApiResponse<SendMessageResponse>>(
      `${this.getBasePath(spaceId)}/sessions/${sessionId}/messages`,
      body
    ).pipe(
      map(res => {
        if (!res.isSuccess) {
          throw new Error(res.message || 'Failed to send message');
        }
        return res.data;
      }),
      catchError(this.handleError)
    );
  }

  // ─── 4. GET SESSION (with messages) ───────────────────

  /**
   * GET /chat/sessions/{sessionId}
   * Returns: ChatSessionDetailDto { id, title, createdAt, fileNames[], messages[] }
   */
  getSession(spaceId: string, sessionId: string): Observable<ChatSessionDetail> {
    return this.http.get<ApiResponse<ChatSessionDetail>>(
      `${this.getBasePath(spaceId)}/sessions/${sessionId}`
    ).pipe(
      map(res => {
        if (!res.isSuccess) {
          throw new Error(res.message || 'Failed to load chat session');
        }
        return res.data;
      }),
      catchError(this.handleError)
    );
  }

  // ─── 5. DELETE SESSION ─────────────────────────────────

  /**
   * DELETE /chat/sessions/{sessionId}
   * Returns: GeneralResponse { isSuccess, message }
   */
  deleteSession(spaceId: string, sessionId: string): Observable<GeneralResponse> {
    return this.http.delete<GeneralResponse>(
      `${this.getBasePath(spaceId)}/sessions/${sessionId}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ─── ERROR HANDLER ─────────────────────────────────────

  private handleError = (error: HttpErrorResponse | Error): Observable<never> => {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
    }

    let message = 'An error occurred';

    if (error.status === 0) {
      message = 'Cannot connect to server';
    } else if (error.status === 400) {
      console.error('Chat 400 error:', error.error);
      message = error.error?.message || 'Invalid request';
    } else if (error.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error.status === 404) {
      message = 'Chat session not found';
    } else if (error.status === 429) {
      message = 'AI rate limit reached. Please wait and try again.';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    return throwError(() => new Error(message));
  };
}
