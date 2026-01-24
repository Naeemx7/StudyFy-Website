import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, tap, delay } from 'rxjs';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'professional';
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'asc_auth_user';
  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(this.load());

  readonly currentUser$ = this.currentUserSubject.asObservable();

  login(email: string, password: string): Observable<AuthUser> {
    const user: AuthUser = {
      id: 'mock-id',
      name: email.split('@')[0] || 'User',
      email,
      role: 'student',
      token: 'mock-token'
    };
    return of(user).pipe(
      delay(400),
      tap((u) => this.persist(u))
    );
  }

  signup(name: string, email: string, password: string, role: 'student' | 'professional'): Observable<AuthUser> {
    const user: AuthUser = {
      id: crypto.randomUUID(),
      name,
      email,
      role,
      token: 'mock-token'
    };
    return of(user).pipe(
      delay(500),
      tap((u) => this.persist(u))
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value?.token;
  }

  private persist(user: AuthUser): void {
    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private load(): AuthUser | null {
    const raw = localStorage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) as AuthUser : null;
  }
}
