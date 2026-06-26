import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { BadgeService, BadgeStatus, BadgeTier, TIER_COLORS } from '../../services/badge.service';
import { User } from '../../models/auth.models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './profile.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private analyticsService = inject(AnalyticsService);
  private badgeService = inject(BadgeService);

  user: User | null = null;
  badgeStatuses: BadgeStatus[] = [];

  totalXp = 0;
  streak = 0;
  longestStreak = 0;
  analyticsLoading = true;
  analyticsError = '';

  photoUploading = false;
  photoError = '';
  /** Blob URL created from the locally-selected file — shown immediately on upload */
  localPhotoUrl: string | null = null;
  photoBroken = false;

  /** badges awarded on the server (from analytics endpoint) */
  serverBadges: string[] = [];

  readonly tierColors = TIER_COLORS;

  ngOnInit(): void {
    this.auth.currentUser$.subscribe(u => { this.user = u; });

    this.badgeStatuses = this.badgeService.getAllBadgeStatuses();

    this.loadPhotoFromServer();

    this.analyticsService.getGlobalAnalytics().subscribe({
      next: data => {
        this.totalXp = data.totalXp ?? 0;
        this.streak = data.currentStreak ?? 0;
        this.longestStreak = data.longestStreak ?? 0;
        this.serverBadges = data.userBadges ?? [];
        this.analyticsLoading = false;
      },
      error: () => {
        this.analyticsLoading = false;
        this.analyticsError = 'Could not load analytics';
      }
    });
  }

  ngOnDestroy(): void {
    if (this.localPhotoUrl) URL.revokeObjectURL(this.localPhotoUrl);
  }

  private setBlobUrl(url: string): void {
    if (this.localPhotoUrl) URL.revokeObjectURL(this.localPhotoUrl);
    this.localPhotoUrl = url;
    this.photoBroken = false;
  }

  private loadPhotoFromServer(): void {
    this.auth.fetchProfilePhoto().subscribe({
      next: url => this.setBlobUrl(url),
      error: () => { /* no photo on server yet */ }
    });
  }

  get displayPhotoUrl(): string | null {
    return this.localPhotoUrl || null;
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Instant local preview
    this.setBlobUrl(URL.createObjectURL(file));
    this.photoUploading = true;
    this.photoError = '';

    this.auth.uploadProfilePhoto(file).subscribe({
      next: () => {
        this.photoUploading = false;
        // Replace local preview with the authenticated server copy
        this.loadPhotoFromServer();
      },
      error: (err: Error) => {
        this.photoUploading = false;
        this.localPhotoUrl = null;
        this.photoError = err.message || 'Failed to upload photo';
      }
    });

    input.value = '';
  }

  onPhotoLoadError(): void {
    this.localPhotoUrl = null;
    this.photoBroken = true;
  }

  removePhoto(): void {
    this.photoUploading = true;
    this.photoError = '';

    this.auth.deleteProfilePhoto().subscribe({
      next: () => {
        this.photoUploading = false;
        if (this.localPhotoUrl) URL.revokeObjectURL(this.localPhotoUrl);
        this.localPhotoUrl = null;
        this.photoBroken = false;
      },
      error: (err: Error) => {
        this.photoUploading = false;
        this.photoError = err.message || 'Failed to remove photo';
      }
    });
  }

  get earnedCount(): number {
    return this.badgeStatuses.filter(b => b.tier !== 'LOCKED').length;
  }

  get displayName(): string {
    const u = this.user;
    if (!u) return 'User';
    const name = u.googleDisplayName || u.userName || '';
    return name.includes('@') ? name.split('@')[0] : name;
  }

  getInitials(): string {
    return this.displayName.charAt(0).toUpperCase() || 'U';
  }

  tierLabel(tier: BadgeTier): string {
    return tier === 'LOCKED' ? 'Locked' : tier.charAt(0) + tier.slice(1).toLowerCase();
  }

  tierBgClass(tier: BadgeTier): string {
    return {
      LOCKED: 'bg-gray-100 text-gray-500',
      BRONZE: 'bg-amber-50  text-amber-700',
      SILVER: 'bg-slate-100 text-slate-600',
      GOLD:   'bg-yellow-50 text-yellow-700',
    }[tier];
  }

  cardBorderClass(tier: BadgeTier): string {
    return {
      LOCKED: 'border-gray-200',
      BRONZE: 'border-amber-200',
      SILVER: 'border-slate-300',
      GOLD:   'border-yellow-300',
    }[tier];
  }
}
