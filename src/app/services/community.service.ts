/**
 * Community Service
 *
 * Handles all Community-related API endpoints.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  ApiResponse,
  Community,
  CreateCommunityRequest,
  Leaderboard,
  Post,
  Reply,
  CreateReplyRequest,
  CommunityFile,
} from '../models/community.models';

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private communitiesSubject = new BehaviorSubject<Community[]>([]);
  communities$ = this.communitiesSubject.asObservable();

  // ─── helpers ───────────────────────────────────────

  private userPath(): string {
    const userId = this.auth.getCurrentUserId();
    return `${environment.apiUrl}/users/${userId}`;
  }

  // ─── COMMUNITY CRUD ────────────────────────────────

  /** GET /users/{userId}/communities — list all communities for the current user */
  listCommunities(): Observable<ApiResponse<Community[]>> {
    const url = `${this.userPath()}/communities`;
    return this.http.get<ApiResponse<Community[]>>(url).pipe(
      tap(res => { if (res.isSuccess) this.communitiesSubject.next(res.data || []); })
    );
  }

  /** POST /users/{userId}/communities — create a new community */
  createCommunity(req: CreateCommunityRequest): Observable<ApiResponse<Community>> {
    const url = `${this.userPath()}/communities`;
    return this.http.post<ApiResponse<Community>>(url, req).pipe(
      tap(res => {
        if (res.isSuccess && res.data) {
          const current = this.communitiesSubject.value ?? [];
          this.communitiesSubject.next([res.data, ...current]);
        }
      })
    );
  }

  /** GET /communities/{communityId} — get community detail */
  getCommunityDetail(communityId: string): Observable<ApiResponse<Community>> {
    const url = `${environment.apiUrl}/communities/${communityId}`;
    return this.http.get<ApiResponse<Community>>(url).pipe(
      tap(res => {
        if (!res.isSuccess) {
          throw new Error(res.message || 'Failed to fetch community details');
        }
      })
    );
  }

  /** DELETE /users/{userId}/communities/{communityId} — delete community (admin only) */
  deleteCommunity(communityId: string): Observable<ApiResponse<string>> {
    const url = `${this.userPath()}/communities/${communityId}`;
    return this.http.delete<ApiResponse<string>>(url).pipe(
      tap(res => {
        if (res.isSuccess) {
          const updated = (this.communitiesSubject.value || []).filter(c => c.id !== communityId);
          this.communitiesSubject.next(updated);
        }
      })
    );
  }

  // ─── JOIN / LEAVE ──────────────────────────────────

  /** POST /users/{userId}/communities/{joinCode}/join — join a community by code */
  joinCommunity(joinCode: string): Observable<ApiResponse<Community>> {
    const url = `${this.userPath()}/communities/${joinCode}/join`;
    return this.http.post<ApiResponse<Community>>(url, {}).pipe(
      tap(res => {
        if (!res) throw new Error('Invalid response from server');
        if (!res.isSuccess) throw new Error(res.message || 'Failed to join community');
      })
    );
  }

  /** DELETE /users/{userId}/communities/{communityId}/leave — leave a community */
  leaveCommunity(communityId: string): Observable<ApiResponse<null>> {
    const url = `${this.userPath()}/communities/${communityId}/leave`;
    return this.http.delete<ApiResponse<null>>(url).pipe(
      tap(res => {
        if (res.isSuccess) {
          const updated = (this.communitiesSubject.value || []).filter(c => c.id !== communityId);
          this.communitiesSubject.next(updated);
        }
      })
    );
  }

  // ─── LEADERBOARD ───────────────────────────────────

  /** GET /communities/{communityId}/leaderBoard — paginated leaderboard */
  getLeaderboard(communityId: string, page = 1, pageSize = 10): Observable<ApiResponse<Leaderboard>> {
    const url = `${environment.apiUrl}/communities/${communityId}/leaderBoard?currentPage=${page}&pageSize=${pageSize}`;
    return this.http.get<ApiResponse<Leaderboard>>(url).pipe(
      tap(res => {
        if (!res.isSuccess) throw new Error(res.message || 'Failed to fetch leaderboard');
      })
    );
  }

  // ─── COMMUNITY PHOTO ──────────────────────────────

  /** POST /communities/{communityId}/photo — upload community photo (form data) */
  uploadCommunityPhoto(communityId: string, file: File): Observable<ApiResponse<string>> {
    const url = `${environment.apiUrl}/communities/${communityId}/photo`;
    const formData = new FormData();
    // The backend expects the parameter name to be 'file'.
    formData.append('file', file);
    return this.http.post<ApiResponse<string>>(url, formData);
  }

  /** DELETE /communities/{communityId}/photo — delete community photo */
  deleteCommunityPhoto(communityId: string): Observable<ApiResponse<null>> {
    const url = `${environment.apiUrl}/communities/${communityId}/photo`;
    return this.http.delete<ApiResponse<null>>(url);
  }

  /** GET /communities/{communityId}/photo — returns photo URL */
  getCommunityPhotoUrl(communityId: string): string {
    return `${environment.apiUrl}/communities/${communityId}/photo`;
  }

  // ─── POSTS ─────────────────────────────────────────

  /**
   * POST /communities/{communityId}/posts — create a post (multipart form data)
   * Query param: userId
   */
  createPost(communityId: string, title: string, content: string, photo?: File): Observable<ApiResponse<Post>> {
    const userId = this.auth.getCurrentUserId();
    const url = `${environment.apiUrl}/communities/${communityId}/posts?userId=${userId}`;
    const formData = new FormData();
    formData.append('Title', title);
    formData.append('Content', content);
    if (photo) {
      formData.append('Photo', photo);
    }
    return this.http.post<ApiResponse<Post>>(url, formData);
  }

  /** GET /communities/{communityId}/posts — paginated post list */
  listPosts(communityId: string, page = 1, pageSize = 10): Observable<ApiResponse<Post[]>> {
    const url = `${environment.apiUrl}/communities/${communityId}/posts?page=${page}&pageSize=${pageSize}`;
    return this.http.get<ApiResponse<Post[]>>(url);
  }

  /** GET /communities/{communityId}/posts/{postId} — get single post with replies */
  getPost(communityId: string, postId: string): Observable<ApiResponse<Post>> {
    const url = `${environment.apiUrl}/communities/${communityId}/posts/${postId}`;
    return this.http.get<ApiResponse<Post>>(url);
  }

  /** GET /communities/{communityId}/posts/{postId}/photo — returns photo URL */
  getPostPhotoUrl(communityId: string, postId: string): string {
    return `${environment.apiUrl}/communities/${communityId}/posts/${postId}/photo`;
  }

  // ─── REPLIES ───────────────────────────────────────

  /**
   * POST /communities/{communityId}/posts/{postId}/replies — reply to a post
   * Query param: userId
   */
  createReply(communityId: string, postId: string, body: CreateReplyRequest): Observable<ApiResponse<Reply>> {
    const userId = this.auth.getCurrentUserId();
    const url = `${environment.apiUrl}/communities/${communityId}/posts/${postId}/replies?userId=${userId}`;
    return this.http.post<ApiResponse<Reply>>(url, body);
  }

  // ─── COMMUNITY STORAGE ─────────────────────────────

  /** POST /users/{userId}/communities/{communityId}/storage/sas — get SAS upload token */
  getCommunityStorageSas(communityId: string, body: unknown): Observable<ApiResponse<unknown>> {
    const url = `${this.userPath()}/communities/${communityId}/storage/sas`;
    return this.http.post<ApiResponse<unknown>>(url, body);
  }

  /** GET /users/{userId}/communities/{communityId}/storage/content — list community files */
  listCommunityFiles(communityId: string, fileName?: string): Observable<ApiResponse<CommunityFile[]>> {
    let url = `${this.userPath()}/communities/${communityId}/storage/content`;
    if (fileName) {
      url += `?fileName=${encodeURIComponent(fileName)}`;
    }
    return this.http.get<ApiResponse<CommunityFile[]>>(url);
  }

  /** Same as listCommunityFiles but using a specific user's ID (for cross-user file resolution) */
  listCommunityFilesAsUser(userId: string, communityId: string, fileName?: string): Observable<ApiResponse<CommunityFile[]>> {
    let url = `${environment.apiUrl}/users/${userId}/communities/${communityId}/storage/content`;
    if (fileName) {
      url += `?fileName=${encodeURIComponent(fileName)}`;
    }
    return this.http.get<ApiResponse<CommunityFile[]>>(url);
  }

  /** DELETE /users/{userId}/communities/{communityId}/files/{fileId} — delete a file */
  deleteCommunityFile(communityId: string, fileId: string): Observable<ApiResponse<string>> {
    const url = `${this.userPath()}/communities/${communityId}/files/${fileId}`;
    return this.http.delete<ApiResponse<string>>(url);
  }

  /** GET /users/{userId}/communities/{communityId}/files/{fileId}/download — download a file */
  downloadCommunityFile(communityId: string, fileId: string): Observable<Blob> {
    const url = `${this.userPath()}/communities/${communityId}/files/${fileId}/download`;
    return this.http.get(url, { responseType: 'blob' });
  }

  /** Same as downloadCommunityFile but using a specific user's ID (for cross-user downloads) */
  downloadCommunityFileAsUser(userId: string, communityId: string, fileId: string): Observable<Blob> {
    const url = `${environment.apiUrl}/users/${userId}/communities/${communityId}/files/${fileId}/download`;
    return this.http.get(url, { responseType: 'blob' });
  }

  /** Same as getCommunityStorageSas but using a specific user's ID */
  getCommunityStorageSasAsUser(userId: string, communityId: string, body: unknown): Observable<ApiResponse<unknown>> {
    const url = `${environment.apiUrl}/users/${userId}/communities/${communityId}/storage/sas`;
    return this.http.post<ApiResponse<unknown>>(url, body);
  }
}
