import { Component, inject, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { SpaceService } from '../../services/space.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private analyticsService = inject(AnalyticsService);
  private spaceService = inject(SpaceService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);

  currentUser$ = this.auth.currentUser$;
  streak = 0;
  navPhotoUrl: string | null = null;
  avatarDropdownOpen = false;

  activeTheme: 'light' | 'dark' = 'light';
  activeLanguage: 'en' | 'ar' = 'en';
  showDeleteConfirm = false;

  private lastPhotoId: string | undefined;

  ngOnInit(): void {
    this.analyticsService.getGlobalAnalytics().subscribe({
      next: (data) => { this.streak = data.currentStreak ?? 0; },
      error: () => {},
    });

    this.auth.currentUser$.subscribe(user => {
      if (user?.photoId && user.photoId !== this.lastPhotoId) {
        this.lastPhotoId = user.photoId;
        this.auth.fetchProfilePhoto().subscribe({
          next: url => { this.navPhotoUrl = url; },
          error: () => { this.navPhotoUrl = null; }
        });
      } else if (!user?.photoId && this.lastPhotoId) {
        this.lastPhotoId = undefined;
        this.navPhotoUrl = null;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.navPhotoUrl) URL.revokeObjectURL(this.navPhotoUrl);
  }

  getInitials(name: string | undefined): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  getDisplayName(name: string | undefined): string {
    if (!name) return 'User';
    if (name.includes('@')) return name.split('@')[0];
    return name;
  }

  toggleAvatarDropdown(): void {
    this.avatarDropdownOpen = !this.avatarDropdownOpen;
  }

  closeAvatarDropdown(): void {
    this.avatarDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.avatarDropdownOpen) {
      this.closeAvatarDropdown();
    }
  }

  logout(): void {
    this.auth.logout();
    this.spaceService.clearSpaces();
    this.router.navigate(['/login']);
  }

  deleteAccount(): void {
    // TODO: call delete account API
    this.showDeleteConfirm = false;
  }
}
