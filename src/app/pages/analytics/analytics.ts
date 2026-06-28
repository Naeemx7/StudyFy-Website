import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { BadgeService, BadgeStatus } from '../../services/badge.service';
import { AnalyticsSpaceDetail, AnalyticsQuizEntry } from '../../models/analytics.models';

interface ChartPoint { x: number; y: number; }
interface ChartLine  { label: string; color: string; points: ChartPoint[]; polyline: string; }

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class AnalyticsComponent implements OnInit {
  private auth          = inject(AuthService);
  private analytics     = inject(AnalyticsService);
  private badgeService  = inject(BadgeService);

  // Top cards
  currentStreak  = 0;
  longestStreak  = 0;
  totalXp        = 0;
  avgScore       = 0;

  // Loading
  loading = true;
  error   = '';

  // Badges (from badgeService, updated with server data)
  badges: BadgeStatus[] = [];

  // Space performance cards
  spaceDetails: AnalyticsSpaceDetail[] = [];

  // Chart
  chartLines: ChartLine[] = [];
  chartWidth  = 700;
  chartHeight = 220;
  chartPadL   = 40;
  chartPadB   = 30;
  chartPadR   = 20;
  chartPadT   = 10;
  yLabels     = [0, 25, 50, 75, 100];

  // Nav photo
  navPhotoUrl: string | null = null;
  private lastPhotoId: string | undefined;
  avatarDropdownOpen = false;
  currentUser$ = this.auth.currentUser$;

  ngOnInit(): void {
    this.badges = this.badgeService.getAllBadgeStatuses();

    this.auth.currentUser$.subscribe(user => {
      if (user?.photoId && user.photoId !== this.lastPhotoId) {
        this.lastPhotoId = user.photoId;
        this.auth.fetchProfilePhoto().subscribe({
          next: url => { this.navPhotoUrl = url; },
          error: () => { this.navPhotoUrl = null; }
        });
      }
    });

    this.analytics.getGlobalAnalytics().subscribe({
      next: data => {
        this.currentStreak = data.currentStreak ?? 0;
        this.longestStreak = data.longestStreak  ?? 0;
        this.totalXp       = data.totalXp        ?? 0;
        this.spaceDetails  = data.spaceDetails   ?? [];

        // Avg score across all spaces weighted by quiz count
        const totalQ = this.spaceDetails.reduce((s, d) => s + (d.totalQuizzes ?? 0), 0);
        if (totalQ > 0) {
          const weighted = this.spaceDetails.reduce(
            (s, d) => s + (d.averageScore ?? 0) * (d.totalQuizzes ?? 0), 0
          );
          this.avgScore = Math.round(weighted / totalQ);
        }

        // Update badges with server confirmed list
        if (data.userBadges?.length) {
          this.badges = this.badgeService.getAllBadgeStatuses();
        }

        // Build chart from quizData
        if (data.quizData?.length) {
          this.buildChart(data.quizData);
        }

        this.loading = false;
      },
      error: (err: Error) => {
        this.error   = err.message || 'Failed to load analytics';
        this.loading = false;
      }
    });
  }

  private buildChart(quizData: AnalyticsQuizEntry[]): void {
    const sorted = [...quizData].sort((a, b) => new Date(a.quizDate).getTime() - new Date(b.quizDate).getTime());
    const groups: Record<string, AnalyticsQuizEntry[]> = {};
    for (const q of sorted) {
      const key = (q.difficultyLevel ?? 'Easy').toLowerCase();
      const label = key === 'hard' ? 'Hard' : key === 'medium' ? 'Medium' : 'Easy';
      (groups[label] = groups[label] ?? []).push(q);
    }

    const W = this.chartWidth  - this.chartPadL - this.chartPadR;
    const H = this.chartHeight - this.chartPadT - this.chartPadB;

    const allDates = sorted.map(q => new Date(q.quizDate).getTime());
    const minT = allDates[0] ?? 0;
    const maxT = allDates[allDates.length - 1] ?? 1;
    const rangeT = maxT - minT || 1;

    const colorMap: Record<string, string> = { Easy: '#22c55e', Medium: '#f59e0b', Hard: '#ef4444' };

    this.chartLines = Object.entries(groups).map(([label, entries]) => {
      const points: ChartPoint[] = entries.map(q => ({
        x: this.chartPadL + ((new Date(q.quizDate).getTime() - minT) / rangeT) * W,
        y: this.chartPadT + H - (AnalyticsService.normaliseScore(q.score) / 100) * H,
      }));
      const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      return { label, color: colorMap[label] ?? '#888', points, polyline };
    });
  }

  getYCoord(value: number): number {
    const H = this.chartHeight - this.chartPadT - this.chartPadB;
    return this.chartPadT + H - (value / 100) * H;
  }

  getSpaceColor(name: string): string {
    const colors = ['#4f46e5', '#10b981', '#f0532c', '#f88a1d', '#8b5cf6', '#ec4899'];
    return colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  }

  getSpaceInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  getNormScore(score: number): number {
    return AnalyticsService.normaliseScore(score);
  }

  get displayName(): string {
    const u = this.auth.getCurrentUser();
    if (!u) return 'User';
    const n = u.googleDisplayName || u.userName || '';
    return n.includes('@') ? n.split('@')[0] : (n || 'User');
  }

  getInitials(): string {
    return this.displayName.charAt(0).toUpperCase() || 'U';
  }

  toggleAvatarDropdown(e: Event): void {
    e.stopPropagation();
    this.avatarDropdownOpen = !this.avatarDropdownOpen;
  }

  closeDropdown(): void { this.avatarDropdownOpen = false; }

  logout(): void {
    this.auth.logout();
  }

  // Badge helpers
  getBadgeBgStyle(tier: string): string {
    const map: Record<string, string> = {
      LOCKED: 'background:#f3f4f6;opacity:0.5',
      BRONZE: 'background:#fef3c7',
      SILVER: 'background:#f1f5f9',
      GOLD:   'background:#fefce8',
    };
    return map[tier] ?? 'background:#f0efff';
  }
}
