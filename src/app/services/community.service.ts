import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ApiResponse, Community, CreateCommunityRequest, Leaderboard } from '../models/community.models';

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private communitiesSubject = new BehaviorSubject<Community[]>([]);
  communities$ = this.communitiesSubject.asObservable();

  listCommunities(): Observable<ApiResponse<Community[]>> {
    const userId = this.auth.getCurrentUserId();
    const url = `${environment.apiUrl}/users/${userId}/communities`;
    return this.http.get<ApiResponse<Community[]>>(url).pipe(
      tap(res => { if (res.isSuccess) this.communitiesSubject.next(res.data || []); })
    );
  }

  createCommunity(req: CreateCommunityRequest): Observable<ApiResponse<Community>> {
    const userId = this.auth.getCurrentUserId();
    const url = `${environment.apiUrl}/users/${userId}/communities`;
    return this.http.post<ApiResponse<Community>>(url, req).pipe(
      tap(res => {
        if (res.isSuccess && res.data) {
          const current = this.communitiesSubject.value ?? [];
          this.communitiesSubject.next([res.data, ...current]);
        }
      })
    );
  }

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

  deleteCommunity(communityId: string): Observable<ApiResponse<string>> {
    const url = `${environment.apiUrl}/communities/${communityId}`;
    return this.http.delete<ApiResponse<string>>(url).pipe(
      tap(res => {
        if (res.isSuccess) {
          const updated = (this.communitiesSubject.value || []).filter(c => c.id !== communityId);
          this.communitiesSubject.next(updated);
        }
      })
    );
  }

  joinCommunity(joinCode: string): Observable<ApiResponse<Community>> {
    const userId = this.auth.getCurrentUserId();
    const url = `${environment.apiUrl}/users/${userId}/communities/${joinCode}/join`;
    return this.http.post<ApiResponse<Community>>(url, {}).pipe(
      tap(res => {
        // Validate response structure
        if (!res) {
          throw new Error('Invalid response from server');
        }
        // Check if API call succeeded
        if (!res.isSuccess) {
          throw new Error(res.message || 'Failed to join community');
        }
        // Note: Backend returns StringGeneralResponse, so res.data is just a string
        // We don't update BehaviorSubject here; component will call load() to fetch full list
      })
    );
  }

  leaveCommunity(communityId: string): Observable<ApiResponse<null>> {
    const userId = this.auth.getCurrentUserId();
    const url = `${environment.apiUrl}/users/${userId}/communities/${communityId}/leave`;
    return this.http.delete<ApiResponse<null>>(url).pipe(
      tap(res => {
        if (res.isSuccess) {
          const updated = (this.communitiesSubject.value || []).filter(c => c.id !== communityId);
          this.communitiesSubject.next(updated);
        }
      })
    );
  }

  getLeaderboard(communityId: string, page = 1, pageSize = 10): Observable<ApiResponse<Leaderboard>> {
    const url = `${environment.apiUrl}/communities/${communityId}/leaderBoard?currentPage=${page}&pageSize=${pageSize}`;
    return this.http.get<ApiResponse<Leaderboard>>(url).pipe(
      tap(res => {
        if (!res.isSuccess) {
          throw new Error(res.message || 'Failed to fetch leaderboard');
        }
      })
    );
  }
}
