import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunityService } from '../../services/community.service';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Community, LeaderboardEntry, CreateCommunityRequest } from '../../models/community.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NavbarComponent],
  templateUrl: './communities.html',
  styleUrls: ['./communities.css']
})
export class CommunitiesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private communityService = inject(CommunityService);
  private destroyRef = inject(DestroyRef);

  communities$ = this.communityService.communities$;
  loading = false;
  searchTerm = '';
  activeCommunityId: string | null = null;
  communitiesCache: Community[] = [];

  // Toast messages for endpoint feedback
  toast: { type: 'success' | 'error'; message: string; visible: boolean } = {
    type: 'success',
    message: '',
    visible: false
  };

  // Endpoint testing state
  detailLoadingId: string | null = null;
  leaderboardLoadingId: string | null = null;
  createLoading = false;
  joinLoading = false;
  leaveLoadingId: string | null = null;
  deleteLoadingId: string | null = null;

  // Selected detail + leaderboard state for testing
  selectedDetail: Community | null = null;
  leaderboard: LeaderboardEntry[] = [];
  leaderboardMeta: { currentPage: number; totalPages: number; totalCount: number } | null = null;

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['']
  });

  joinForm = this.fb.group({ joinCode: ['', [Validators.required]] });

  ngOnInit(): void {
    this.communityService.communities$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(communities => {
        this.communitiesCache = communities ?? [];
      });
    this.load();
  }

  load() {
    this.loading = true;
    this.communityService.listCommunities().subscribe({
      next: () => (this.loading = false),
      error: () => (this.loading = false)
    });
  }

  refresh() {
    this.load();
  }

  filteredCommunities(communities: Community[] | null | undefined): Community[] {
    const list = communities ?? [];
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return list;
    }

    return list.filter(community =>
      (community.name ?? '').toLowerCase().includes(term) ||
      (community.description ?? '').toLowerCase().includes(term) ||
      (community.joinCode ?? '').toLowerCase().includes(term)
    );
  }

  create() {
    if (this.createForm.invalid) return;
    this.createLoading = true;
    const fv = this.createForm.value;
    const payload: CreateCommunityRequest = {
      name: fv.name ?? '',
      description: fv.description ?? undefined
    };
    this.communityService.createCommunity(payload).subscribe({
      next: (res) => {
        this.createLoading = false;
        if (res.isSuccess && res.data) {
          this.createForm.reset({ name: '', description: '' });
          this.showToast('success', 'Community created successfully!');
          this.clearSelected(); // Reset any selected community
        } else {
          this.showToast('error', res.message || 'Failed to create community');
        }
      },
      error: (err) => {
        this.createLoading = false;
        this.showToast('error', `Create failed: ${err.message || 'Unknown error'}`);
      }
    });
  }

  join() {
    if (this.joinForm.invalid) return;
    this.joinLoading = true;
    const code = this.joinForm.value.joinCode as string;
    this.communityService.joinCommunity(code).subscribe({
      next: (res) => {
        this.joinLoading = false;
        if (res.isSuccess) {
          this.joinForm.reset({ joinCode: '' });
          // Show success in green
          this.showToast('success', 'Joined community successfully!');
          // Immediately refresh the list to show the newly joined community
          this.load();
        } else {
          this.showToast('error', res.message || 'Failed to join community');
        }
      },
      error: (err) => {
        this.joinLoading = false;
        this.showToast('error', `Join failed: ${err.message || 'Invalid join code'}`);
      }
    });
  }

  leave(id: string) {
    this.leaveLoadingId = id;
    this.communityService.leaveCommunity(id).subscribe({
      next: () => {
        this.leaveLoadingId = null;
        this.showToast('success', 'Left community successfully!');
      },
      error: (err) => {
        this.leaveLoadingId = null;
        this.showToast('error', `Leave failed: ${err.message || 'Unknown error'}`);
      }
    });
  }

  delete(id: string) {
    this.deleteLoadingId = id;
    this.communityService.deleteCommunity(id).subscribe({
      next: () => {
        this.deleteLoadingId = null;
        if (this.activeCommunityId === id) {
          this.clearSelected();
        }
        this.showToast('success', 'Community deleted successfully!');
      },
      error: (err) => {
        if (err?.status === 500) {
          this.communityService.leaveCommunity(id).subscribe({
            next: () => {
              this.deleteLoadingId = null;
              if (this.activeCommunityId === id) {
                this.clearSelected();
              }
              this.load();
              this.showToast('success', 'Removed from your communities.');
            },
            error: () => {
              this.deleteLoadingId = null;
              this.showToast('error', 'Delete failed and fallback removal also failed.');
            }
          });
          return;
        }

        this.deleteLoadingId = null;
        this.showToast('error', `Delete failed: ${err.message || 'Unknown error'}`);
      }
    });
  }

  viewDetail(id: string) {
    this.detailLoadingId = id;
    this.activeCommunityId = id;
    this.selectedDetail = null;
    this.communityService.getCommunityDetail(id).subscribe({
      next: res => {
        this.detailLoadingId = null;
        this.selectedDetail = res.data;
        this.activeCommunityId = res.data?.id ?? id;
        this.showToast('success', 'Community detail loaded!');
      },
      error: (err) => {
        this.detailLoadingId = null;
        this.showToast('error', `Detail fetch failed: ${err.message || 'Unknown error'}`);
      }
    });
  }

  viewLeaderboard(id: string, page = 1) {
    this.leaderboardLoadingId = id;
    this.activeCommunityId = id;
    this.leaderboard = [];
    this.leaderboardMeta = null;
    this.communityService.getLeaderboard(id, page, 10).subscribe({
      next: res => {
        this.leaderboardLoadingId = null;
        this.leaderboard = res.data?.leaderboard ?? [];
        this.leaderboardMeta = {
          currentPage: res.data?.currentPage ?? page,
          totalPages: res.data?.totalPages ?? 1,
          totalCount: res.data?.totalCount ?? this.leaderboard.length
        };
        this.showToast('success', `Leaderboard loaded (${this.leaderboard.length} entries)!`);
      },
      error: (err) => {
        this.leaderboardLoadingId = null;
        this.showToast('error', `Leaderboard fetch failed: ${err.message || 'Unknown error'}`);
      }
    });
  }

  clearSelected() {
    this.activeCommunityId = null;
    this.selectedDetail = null;
    this.leaderboard = [];
    this.leaderboardMeta = null;
  }

  copyJoinCode(code?: string) {
    if (!code) {
      this.showToast('error', 'No join code available for this community.');
      return;
    }

    navigator.clipboard.writeText(code)
      .then(() => this.showToast('success', 'Join code copied to clipboard.'))
      .catch(() => this.showToast('error', 'Unable to copy join code.'));
  }

  formatDate(value?: string): string {
    if (!value) return 'Unknown date';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
  }

  showToast(type: 'success' | 'error', message: string) {
    this.toast = { type, message, visible: true };
    setTimeout(() => {
      this.toast.visible = false;
    }, 3000);
  }
}
