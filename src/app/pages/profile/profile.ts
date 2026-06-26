import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { BadgeService, BadgeStatus, BadgeTier, TIER_COLORS } from '../../services/badge.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './profile.html',
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private analyticsService = inject(AnalyticsService);
  private badgeService = inject(BadgeService);

  user = this.auth.getCurrentUser();
  badgeStatuses: BadgeStatus[] = [];

  totalXp = 0;
  streak = 0;
  longestStreak = 0;
  analyticsLoading = true;
  analyticsError = '';

  /** badges awarded on the server (from analytics endpoint) */
  serverBadges: string[] = [];

  readonly tierColors = TIER_COLORS;

  ngOnInit(): void {
    this.badgeStatuses = this.badgeService.getAllBadgeStatuses();

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
