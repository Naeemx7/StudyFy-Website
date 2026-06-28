import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { SpaceService } from '../../services/space.service';
import { CommunityService } from '../../services/community.service';
import { User, TARGET_OPTIONS } from '../../models/auth.models';
import { Community } from '../../models/community.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './profile.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private analyticsService = inject(AnalyticsService);
  private spaceService = inject(SpaceService);
  private communityService = inject(CommunityService);

  readonly targetOptions = TARGET_OPTIONS;

  user: User | null = null;
  currentUser$ = this.auth.currentUser$;

  avatarDropdownOpen = false;

  // Analytics stats
  streak = 0;
  totalSpaces = 0;
  totalQuizzes = 0;
  avgScore: number | null = null;
  analyticsLoading = true;

  // Communities
  communities: Community[] = [];
  communitiesLoading = true;

  // Photo
  photoUploading = false;
  photoError = '';
  localPhotoUrl: string | null = null;
  photoBroken = false;
  private lastPhotoId: string | undefined;

  // Edit modal
  showEditModal = false;
  editSaving = false;
  editError = '';
  editSuccess = false;
  editForm = { userName: '', age: 0, isStudent: true, target: '' };

  // Photo file input ref for modal
  editPhotoFile: File | null = null;
  editPhotoPreview: string | null = null;

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.auth.currentUser$.subscribe(u => { this.user = u; })
    );

    this.loadPhoto();

    // Analytics
    this.analyticsService.getGlobalAnalytics().subscribe({
      next: data => {
        this.streak = data.currentStreak ?? 0;
        this.totalQuizzes = data.spaceDetails?.reduce((s, d) => s + (d.totalQuizzes ?? 0), 0) ?? 0;
        const totalQ = this.totalQuizzes;
        if (totalQ > 0 && data.spaceDetails?.length) {
          const weighted = data.spaceDetails.reduce((s, d) => s + (d.averageScore ?? 0) * (d.totalQuizzes ?? 0), 0);
          this.avgScore = Math.round(weighted / totalQ);
        }
        this.analyticsLoading = false;
      },
      error: () => { this.analyticsLoading = false; }
    });

    // Spaces count
    this.subs.push(
      this.spaceService.spaces$.subscribe(spaces => { this.totalSpaces = spaces.length; })
    );
    this.spaceService.loadSpaces().subscribe();

    // Communities
    this.communityService.listCommunities().subscribe({
      next: res => {
        this.communities = res.data?.slice(0, 3) ?? [];
        this.communitiesLoading = false;
      },
      error: () => { this.communitiesLoading = false; }
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.localPhotoUrl) URL.revokeObjectURL(this.localPhotoUrl);
    if (this.editPhotoPreview) URL.revokeObjectURL(this.editPhotoPreview);
  }

  private loadPhoto(): void {
    this.auth.fetchProfilePhoto().subscribe({
      next: url => { this.localPhotoUrl = url; this.photoBroken = false; },
      error: () => {}
    });
  }

  get displayPhotoUrl(): string | null {
    return this.editPhotoPreview || this.localPhotoUrl || null;
  }

  get displayName(): string {
    const u = this.user;
    if (!u) return 'User';
    const name = u.googleDisplayName || u.userName || '';
    return name.includes('@') ? name.split('@')[0] : (name || 'User');
  }

  getInitials(): string {
    return this.displayName.charAt(0).toUpperCase() || 'U';
  }

  get targetDisplayLabel(): string {
    const val = String(this.user?.target || '');
    if (!val) return '';
    const opt = this.targetOptions.find(o => o.value === val || o.label === val);
    return opt ? opt.label : val;
  }

  getCommunityInitials(name: string): string {
    const words = (name || '').trim().split(/\s+/);
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : (name || '?').charAt(0).toUpperCase();
  }

  getCommunityColor(name: string): string {
    const colors = [
      { bg: '#f0efff', text: '#4e45e4' },
      { bg: '#e1fde5', text: '#006e2f' },
      { bg: '#fff3e0', text: '#e65c00' },
      { bg: '#fce4ec', text: '#b71c1c' },
    ];
    const idx = (name?.charCodeAt(0) ?? 0) % colors.length;
    return `background:${colors[idx].bg};color:${colors[idx].text}`;
  }

  onPhotoLoadError(): void {
    this.localPhotoUrl = null;
    this.photoBroken = true;
  }

  // ── Edit Modal ──────────────────────────────────────
  openEditModal(): void {
    const u = this.user;

    let targetVal = '';
    if (u?.target !== undefined && u?.target !== null) {
      const stringTarget = String(u.target);
      const opt = this.targetOptions.find(o => o.value === stringTarget || o.label === stringTarget);
      targetVal = opt ? opt.value : stringTarget;
    }

    this.editForm = {
      userName: u?.googleDisplayName || u?.userName || '',
      age: u?.age ?? 0,
      isStudent: u?.isStudent ?? true,
      target: targetVal
    };
    this.editPhotoPreview = null;
    this.editPhotoFile = null;
    this.editError = '';
    this.editSuccess = false;
    this.showEditModal = true;
  }

  closeEditModal(): void {
    if (this.editPhotoPreview) {
      URL.revokeObjectURL(this.editPhotoPreview);
      this.editPhotoPreview = null;
    }
    this.editPhotoFile = null;
    this.showEditModal = false;
  }

  onModalPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (this.editPhotoPreview) URL.revokeObjectURL(this.editPhotoPreview);
    this.editPhotoFile = file;
    this.editPhotoPreview = URL.createObjectURL(file);
    input.value = '';
  }

  removeModalPhoto(): void {
    if (this.editPhotoPreview) URL.revokeObjectURL(this.editPhotoPreview);
    this.editPhotoPreview = null;
    this.editPhotoFile = null;
    // Delete from server if there's an existing photo
    if (this.user?.photoId || this.localPhotoUrl) {
      this.auth.deleteProfilePhoto().subscribe({
        next: () => {
          if (this.localPhotoUrl) URL.revokeObjectURL(this.localPhotoUrl);
          this.localPhotoUrl = null;
          this.photoBroken = false;
        },
        error: (err: Error) => { this.editError = err.message || 'Failed to remove photo'; }
      });
    }
  }

  saveProfile(): void {
    this.editError = '';
    const trimmedName = this.editForm.userName.trim();
    if (!trimmedName) {
      this.editError = 'Username cannot be empty.';
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmedName)) {
      this.editError = 'Username can only contain letters and digits — no spaces or special characters.';
      return;
    }
    this.editForm.userName = trimmedName;
    this.editSaving = true;

    this.auth.updateProfile({
      userName: trimmedName,
      age: this.editForm.age || undefined,
      isStudent: this.editForm.isStudent,
      target: this.editForm.target || undefined
    }).subscribe({
      next: () => {
        // If a new photo was selected, upload it
        if (this.editPhotoFile) {
          this.auth.uploadProfilePhoto(this.editPhotoFile).subscribe({
            next: () => {
              this.loadPhoto();
              this.editPhotoPreview = null;
              this.editPhotoFile = null;
              this.editSaving = false;
              this.editSuccess = true;
              setTimeout(() => { this.showEditModal = false; this.editSuccess = false; }, 800);
            },
            error: (err: Error) => {
              this.editSaving = false;
              this.editError = err.message || 'Profile saved but photo upload failed';
            }
          });
        } else {
          this.editSaving = false;
          this.editSuccess = true;
          setTimeout(() => { this.showEditModal = false; this.editSuccess = false; }, 800);
        }
      },
      error: (err: Error) => {
        this.editSaving = false;
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('taken') || msg.includes('already') || msg.includes('duplicate') || msg.includes('exists') || msg.includes('unavailable')) {
          this.editError = `"${this.editForm.userName}" is already taken. Please choose a different username.`;
        } else {
          this.editError = err.message || 'Failed to save profile';
        }
      }
    });
  }

  // ── Top Bar Dropdown ──
  toggleAvatarDropdown(e: Event): void {
    e.stopPropagation();
    this.avatarDropdownOpen = !this.avatarDropdownOpen;
  }

  closeDropdown(): void {
    this.avatarDropdownOpen = false;
  }

  logout(): void {
    this.auth.logout();
  }
}
