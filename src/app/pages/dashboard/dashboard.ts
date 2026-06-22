/**
 * Dashboard Component
 *
 * The main hub after login. Shows:
 * - Welcome message with user's name
 * - Quick stats: totalFiles + totalQuizzes from spaces API, streak + avgScore from analytics
 * - List of user's spaces with real progress percentages
 * - Create new space button/modal
 *
 * DATA FLOW:
 * 1. Component initializes (ngOnInit)
 * 2. loadSpaces() fetches spaces — each space already has totalFiles, totalQuizzes, progress
 * 3. spaces$ subscription sums totalFiles + totalQuizzes for stat cards
 * 4. loadAnalytics() fetches streak + avgScore (silently fails if backend 500s)
 */

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { NavbarComponent } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';
import { SpaceService } from '../../services/space.service';
import { CommunityService } from '../../services/community.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Space } from '../../models/space.models';
import { GlobalAnalytics } from '../../models/analytics.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private spaceService = inject(SpaceService);
  private communityService = inject(CommunityService);
  private analyticsService = inject(AnalyticsService);
  private fb = inject(FormBuilder);
  private spaceSub?: Subscription;

  // User data from auth service
  currentUser$ = this.auth.currentUser$;

  // Spaces filtered to exclude entries that are actually community workspaces.
  // The backend auto-creates a space named "<communityName> Workspace" for every
  // community. We detect these by matching the space title against known community
  // names (both exact match and the "<name> Workspace" pattern the backend uses).
  spaces$ = combineLatest([
    this.spaceService.spaces$,
    this.communityService.communities$
  ]).pipe(
    map(([spaces, communities]) => {
      const communityNames = new Set((communities ?? []).map(c => c.name?.trim().toLowerCase()));
      return spaces.filter(s => {
        const title = (s.title ?? '').trim().toLowerCase();
        // Match "<communityName> Workspace" pattern (backend auto-naming)
        const baseName = title.endsWith(' workspace') ? title.slice(0, -' workspace'.length).trim() : title;
        return !communityNames.has(baseName) && !communityNames.has(title);
      });
    })
  );
  spacesLoading$ = this.spaceService.loading$;
  spacesError$ = this.spaceService.error$;

  // ---- Stat cards ----
  // totalFiles + totalQuizzes come from spaces$ (spaces API returns them directly)
  // streak + avgScore come from analytics API (silently 0/-- if backend 500s)
  streak = 0;
  totalFiles = 0;
  totalQuizzes = 0;
  /** null = no quiz data yet; number = rounded percentage (0–100) */
  avgScore: number | null = null;
  analyticsLoading = false;

  // UI State for Modal
  showCreateModal = false;
  isCreating = false;
  createError = '';

  // UI State for Delete Modal
  showDeleteModal = false;
  isDeleting = false;
  deleteError = '';
  spaceToDelete: Space | null = null;

  // Form for creating a space
  createSpaceForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.maxLength(200)]]
  });

  /**
   * ngOnInit - Called when component initializes
   * This is where we load data from APIs
   */
  ngOnInit(): void {
    // Load spaces — the spaces API returns totalFiles, totalQuizzes, averageScore per space
    this.spaceService.loadSpaces().subscribe();

    // Load communities so we can filter their IDs out of the spaces list
    this.communityService.listCommunities().subscribe();

    // Sum totalFiles + totalQuizzes from spaces that are NOT communities
    this.spaceSub = this.spaces$.subscribe(spaces => {
      this.totalFiles = spaces.reduce((sum, s) => sum + (s.totalFiles ?? 0), 0);
      this.totalQuizzes = spaces.reduce((sum, s) => sum + (s.totalQuizzes ?? 0), 0);
    });

    // Load streak + avgScore from analytics (separate endpoint, may 500)
    this.loadAnalytics();
  }

  ngOnDestroy(): void {
    this.spaceSub?.unsubscribe();
  }

  /**
   * LOAD ANALYTICS
   * Fetches streak + avgScore from analytics endpoint.
   * totalFiles and totalQuizzes come from spaces$ instead — no analytics needed for those.
   * Silently fails (streak stays 0, avgScore stays --) if backend returns 500.
   */
  private loadAnalytics(): void {
    this.analyticsLoading = true;

    this.analyticsService.getGlobalAnalytics().subscribe({
      next: (data: GlobalAnalytics) => {
        this.analyticsLoading = false;
        this.streak = data.currentStreak ?? 0;

        // Use backend's pre-calculated averageScore from spaceDetails (weighted by totalQuizzes)
        if (data.spaceDetails?.length > 0) {
          const totalQuizzes = data.spaceDetails.reduce((sum, s) => sum + (s.totalQuizzes ?? 0), 0);
          if (totalQuizzes > 0) {
            const weightedSum = data.spaceDetails.reduce(
              (sum, s) => sum + (s.averageScore ?? 0) * (s.totalQuizzes ?? 0),
              0
            );
            this.avgScore = Math.round(weightedSum / totalQuizzes);
          }
        }
      },
      error: () => {
        // Silent fail — streak stays 0, avgScore stays --
        this.analyticsLoading = false;
      }
    });
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

  /**
   * CONFIRM DELETE SPACE
   * Opens the delete confirmation modal
   * @param space - The space to delete
   * @param event - Click event (to prevent navigation)
   */
  confirmDeleteSpace(space: Space, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.spaceToDelete = space;
    this.showDeleteModal = true;
    this.deleteError = '';
  }

  /**
   * CANCEL DELETE
   * Closes the delete modal without deleting
   */
  cancelDelete() {
    this.showDeleteModal = false;
    this.spaceToDelete = null;
    this.deleteError = '';
  }

  /**
   * DELETE SPACE
   * Calls the API to delete the space
   */
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

  /**
   * Get display-friendly name
   * For Google users who sign in with email, strips the @domain part
   */
  getDisplayName(userName: string | undefined): string {
    if (!userName) return 'User';
    if (userName.includes('@')) return userName.split('@')[0];
    return userName;
  }
}
