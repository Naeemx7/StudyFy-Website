import { Component, inject, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { SpaceService } from '../../services/space.service';
import { CommunityService } from '../../services/community.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Space } from '../../models/space.models';
import { GlobalAnalytics } from '../../models/analytics.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private spaceService = inject(SpaceService);
  private communityService = inject(CommunityService);
  private analyticsService = inject(AnalyticsService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private spaceSub?: Subscription;

  currentUser$ = this.auth.currentUser$;

  spaces$ = combineLatest([
    this.spaceService.spaces$,
    this.communityService.communities$
  ]).pipe(
    map(([spaces, communities]) => {
      const communityNames = new Set((communities ?? []).map(c => c.name?.trim().toLowerCase()));
      return spaces.filter(s => {
        const title = (s.title ?? '').trim().toLowerCase();
        const baseName = title.endsWith(' workspace') ? title.slice(0, -' workspace'.length).trim() : title;
        return !communityNames.has(baseName) && !communityNames.has(title);
      });
    })
  );
  spacesLoading$ = this.spaceService.loading$;
  spacesError$ = this.spaceService.error$;

  streak = 0;
  totalFiles = 0;
  totalQuizzes = 0;
  totalSpaces = 0;
  avgScore: number | null = null;
  analyticsLoading = false;

  navPhotoUrl: string | null = null;
  avatarDropdownOpen = false;
  private lastPhotoId: string | undefined;

  showCreateModal = false;
  isCreating = false;
  createError = '';

  showDeleteModal = false;
  isDeleting = false;
  deleteError = '';
  spaceToDelete: Space | null = null;

  createSpaceForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.maxLength(200)]]
  });

  private readonly SPACE_COLORS = [
    '#4f46e5', '#10b981', '#f0532c', '#f88a1d', '#8b5cf6', '#ec4899'
  ];

  ngOnInit(): void {
    this.spaceService.loadSpaces().subscribe();
    this.communityService.listCommunities().subscribe();

    this.spaceSub = this.spaces$.subscribe(spaces => {
      this.totalFiles = spaces.reduce((sum, s) => sum + (s.totalFiles ?? 0), 0);
      this.totalQuizzes = spaces.reduce((sum, s) => sum + (s.totalQuizzes ?? 0), 0);
      this.totalSpaces = spaces.length;
    });

    this.loadAnalytics();

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
    this.spaceSub?.unsubscribe();
    if (this.navPhotoUrl) URL.revokeObjectURL(this.navPhotoUrl);
  }

  private loadAnalytics(): void {
    this.analyticsLoading = true;
    this.analyticsService.getGlobalAnalytics().subscribe({
      next: (data: GlobalAnalytics) => {
        this.analyticsLoading = false;
        this.streak = data.currentStreak ?? 0;
        if (data.spaceDetails?.length > 0) {
          const totalQ = data.spaceDetails.reduce((sum, s) => sum + (s.totalQuizzes ?? 0), 0);
          if (totalQ > 0) {
            const weightedSum = data.spaceDetails.reduce(
              (sum, s) => sum + (s.averageScore ?? 0) * (s.totalQuizzes ?? 0), 0
            );
            this.avgScore = Math.round(weightedSum / totalQ);
          }
        }
      },
      error: () => { this.analyticsLoading = false; }
    });
  }

  getSpaceColor(title: string): string {
    if (!title) return this.SPACE_COLORS[0];
    const idx = title.charCodeAt(0) % this.SPACE_COLORS.length;
    return this.SPACE_COLORS[idx];
  }

  getSpaceInitial(title: string): string {
    return title ? title.charAt(0).toUpperCase() : '?';
  }

  getDisplayName(name: string | undefined): string {
    if (!name) return 'User';
    if (name.includes('@')) return name.split('@')[0];
    return name;
  }

  getInitials(name: string | undefined): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
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
    this.router.navigate(['/login']);
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.createError = '';
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.createSpaceForm.reset();
    this.createError = '';
  }

  onCreateSpace() {
    if (this.createSpaceForm.invalid) return;
    this.isCreating = true;
    this.createError = '';
    const { name, description } = this.createSpaceForm.value;
    this.spaceService.createSpace(name, description || '').subscribe({
      next: () => {
        this.isCreating = false;
        this.closeCreateModal();
      },
      error: (err) => {
        this.isCreating = false;
        this.createError = err?.message || 'Failed to create space';
      }
    });
  }

  confirmDeleteSpace(space: Space, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.spaceToDelete = space;
    this.showDeleteModal = true;
    this.deleteError = '';
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.spaceToDelete = null;
    this.deleteError = '';
  }

  deleteSpace() {
    if (!this.spaceToDelete) return;
    this.isDeleting = true;
    this.deleteError = '';
    this.spaceService.deleteSpace(this.spaceToDelete.id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.spaceToDelete = null;
      },
      error: (err) => {
        this.isDeleting = false;
        this.deleteError = err?.message || 'Failed to delete space';
      }
    });
  }
}
