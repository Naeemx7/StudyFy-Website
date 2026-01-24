import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard {
  private auth = inject(AuthService);
  private router = inject(Router);

  canActivate: CanActivateFn = () => {
    if (this.auth.isLoggedIn()) {
      return true;
    }
    return this.router.createUrlTree(['/login']);
  };
}
