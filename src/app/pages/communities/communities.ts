import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunityService } from '../../services/community.service';
import { StorageService } from '../../services/storage.service';
import { NavbarComponent } from '../../components/navbar/navbar';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  Community,
  LeaderboardEntry,
  CreateCommunityRequest,
  Post,
  Reply,
  CommunityFile,
} from '../../models/community.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';

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
  private storageService = inject(StorageService);
  private destroyRef = inject(DestroyRef);

  communities$ = this.communityService.communities$;
  loading = false;
  searchTerm = '';
  activeCommunityId: string | null = null;
  communitiesCache: Community[] = [];

  // Tab management
  activeTab: 'overview' | 'posts' | 'files' | 'settings' = 'overview';

  // Toast messages for endpoint feedback
  toast: { type: 'success' | 'error'; message: string; visible: boolean } = {
    type: 'success',
    message: '',
    visible: false
  };

  // Endpoint loading states
  detailLoadingId: string | null = null;
  leaderboardLoadingId: string | null = null;
  createLoading = false;
  joinLoading = false;
  leaveLoadingId: string | null = null;
  deleteLoadingId: string | null = null;

  // Selected detail + leaderboard state
  selectedDetail: Community | null = null;
  leaderboard: LeaderboardEntry[] = [];
  leaderboardMeta: { currentPage: number; totalPages: number; totalCount: number } | null = null;

  // Posts State
  posts: Post[] = [];
  postsLoading = false;
  selectedPost: Post | null = null;
  postDetailLoading = false;
  createPostLoading = false;
  createReplyLoading = false;
  selectedPostPhoto: File | null = null;

  // Files/Storage State
  files: CommunityFile[] = [];
  filesLoading = false;
  uploadingFile = false;
  uploadProgress = 0;

  // Settings/Photo State
  photoUploading = false;

  // Forms
  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['']
  });

  joinForm = this.fb.group({
    joinCode: ['', [Validators.required]]
  });

  postForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    content: ['', [Validators.required, Validators.minLength(5)]]
  });

  replyForm = this.fb.group({
    content: ['', [Validators.required, Validators.minLength(1)]]
  });

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

  // ─── TABS ──────────────────────────────────────────

  switchTab(tab: 'overview' | 'posts' | 'files' | 'settings') {
    this.activeTab = tab;
    const communityId = this.activeCommunityId;
    if (!communityId) return;

    if (tab === 'overview') {
      this.viewLeaderboard(communityId);
    } else if (tab === 'posts') {
      this.loadPosts(communityId);
    } else if (tab === 'files') {
      this.loadFiles(communityId);
    }
  }

  // ─── CREATE / JOIN / LEAVE ─────────────────────────

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
          this.clearSelected();
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
          this.showToast('success', 'Joined community successfully!');
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
    if (!confirm('Are you sure you want to leave this community?')) return;
    this.leaveLoadingId = id;
    this.communityService.leaveCommunity(id).subscribe({
      next: () => {
        this.leaveLoadingId = null;
        if (this.activeCommunityId === id) {
          this.clearSelected();
        }
        this.load();
        this.showToast('success', 'Left community successfully!');
      },
      error: (err) => {
        this.leaveLoadingId = null;
        this.showToast('error', `Leave failed: ${err.message || 'Unknown error'}`);
      }
    });
  }

  delete(id: string) {
    if (!confirm('Are you sure you want to delete this community? This action is permanent!')) return;
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

  // ─── DETAILS & LEADERBOARD ─────────────────────────

  viewDetail(id: string) {
    this.detailLoadingId = id;
    this.activeCommunityId = id;
    this.selectedDetail = null;
    this.activeTab = 'overview';
    this.selectedPost = null;
    this.posts = [];
    this.files = [];
    this.leaderboard = [];

    this.communityService.getCommunityDetail(id).subscribe({
      next: res => {
        this.detailLoadingId = null;
        this.selectedDetail = res.data;
        this.activeCommunityId = res.data?.id ?? id;
        this.showToast('success', 'Community details loaded!');
        
        // Prefetch basic lists
        this.viewLeaderboard(this.activeCommunityId);
        this.loadPosts(this.activeCommunityId);
        this.loadFiles(this.activeCommunityId);
      },
      error: (err) => {
        this.detailLoadingId = null;
        this.showToast('error', `Detail fetch failed: ${err.message || 'Unknown error'}`);
      }
    });
  }

  viewLeaderboard(id: string, page = 1) {
    this.leaderboardLoadingId = id;
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
    this.posts = [];
    this.selectedPost = null;
    this.files = [];
    this.activeTab = 'overview';
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

  // ─── POSTS & DISCUSSIONS ───────────────────────────

  loadPosts(communityId: string) {
    this.postsLoading = true;
    this.communityService.listPosts(communityId).subscribe({
      next: (res) => {
        this.postsLoading = false;
        if (res.isSuccess) {
          this.posts = res.data || [];
        }
      },
      error: () => {
        this.postsLoading = false;
      }
    });
  }

  viewPost(post: Post) {
    this.postDetailLoading = true;
    this.selectedPost = post;
    this.communityService.getPost(this.activeCommunityId!, post.id).subscribe({
      next: (res) => {
        this.postDetailLoading = false;
        if (res.isSuccess && res.data) {
          this.selectedPost = res.data;
        }
      },
      error: (err) => {
        this.postDetailLoading = false;
        this.showToast('error', `Failed to load post: ${err.message}`);
      }
    });
  }

  onPostPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedPostPhoto = input.files[0];
    }
  }

  removePostPhoto() {
    this.selectedPostPhoto = null;
  }

  createPost() {
    if (this.postForm.invalid || !this.activeCommunityId) return;

    this.createPostLoading = true;
    const { title, content } = this.postForm.value;

    this.communityService.createPost(
      this.activeCommunityId,
      title || '',
      content || '',
      this.selectedPostPhoto || undefined
    ).subscribe({
      next: (res) => {
        this.createPostLoading = false;
        if (res.isSuccess) {
          this.showToast('success', 'Post created successfully!');
          this.postForm.reset();
          this.selectedPostPhoto = null;
          this.loadPosts(this.activeCommunityId!);
        } else {
          this.showToast('error', res.message || 'Failed to create post');
        }
      },
      error: (err) => {
        this.createPostLoading = false;
        this.showToast('error', `Failed to create post: ${err.message}`);
      }
    });
  }

  closePostDetail() {
    this.selectedPost = null;
  }

  // ─── REPLIES ───────────────────────────────────────

  createReply() {
    if (this.replyForm.invalid || !this.activeCommunityId || !this.selectedPost) return;

    this.createReplyLoading = true;
    const { content } = this.replyForm.value;

    this.communityService.createReply(
      this.activeCommunityId,
      this.selectedPost.id,
      { content: content || '' }
    ).subscribe({
      next: (res) => {
        this.createReplyLoading = false;
        if (res.isSuccess && res.data) {
          this.showToast('success', 'Reply posted!');
          this.replyForm.reset();
          
          if (!this.selectedPost!.replies) {
            this.selectedPost!.replies = [];
          }
          this.selectedPost!.replies.push(res.data);
          this.selectedPost!.replyCount = (this.selectedPost!.replyCount || 0) + 1;
          
          const idx = this.posts.findIndex(p => p.id === this.selectedPost!.id);
          if (idx !== -1) {
            this.posts[idx].replyCount = this.selectedPost!.replyCount;
          }
        } else {
          this.showToast('error', res.message || 'Failed to post reply');
        }
      },
      error: (err) => {
        this.createReplyLoading = false;
        this.showToast('error', `Failed to post reply: ${err.message}`);
      }
    });
  }

  // ─── SHARED FILES (STORAGE) ─────────────────────────

  /**
   * Get the localStorage key for tracking community files.
   * The API has no "list all files" endpoint — it only returns info for ONE file
   * via GET /storage/content?fileName=... So we track uploaded filenames in localStorage.
   */
  private getTrackedFilesKey(communityId: string): string {
    return `community_files_${communityId}`;
  }

  private getTrackedFiles(communityId: string): CommunityFile[] {
    try {
      const stored = localStorage.getItem(this.getTrackedFilesKey(communityId));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveTrackedFiles(communityId: string, files: CommunityFile[]) {
    localStorage.setItem(this.getTrackedFilesKey(communityId), JSON.stringify(files));
  }

  private addTrackedFile(communityId: string, file: CommunityFile) {
    const tracked = this.getTrackedFiles(communityId);
    // Avoid duplicates by fileName
    const existing = tracked.findIndex(f => f.fileName === file.fileName);
    if (existing !== -1) {
      tracked[existing] = file; // Update existing
    } else {
      tracked.push(file);
    }
    this.saveTrackedFiles(communityId, tracked);
  }

  private removeTrackedFile(communityId: string, fileId: string) {
    const tracked = this.getTrackedFiles(communityId).filter(f => f.id !== fileId);
    this.saveTrackedFiles(communityId, tracked);
  }

  loadFiles(communityId: string) {
    this.filesLoading = true;

    // Load from localStorage tracking (since the API has no "list all" endpoint)
    const tracked = this.getTrackedFiles(communityId);

    if (tracked.length === 0) {
      // Also try the API without fileName in case it returns something
      this.communityService.listCommunityFiles(communityId).subscribe({
        next: (res: any) => {
          this.filesLoading = false;
          if (res.isSuccess && res.data) {
            const data = res.data;
            if (Array.isArray(data)) {
              this.files = data.map((f: any) => ({
                id: f.fileId || f.id || '',
                fileName: f.fileName || 'Unknown',
                contentType: f.contentType,
                size: f.size,
                uploadedAt: f.uploadedAt
              }));
              // Save to tracking
              this.files.forEach(f => this.addTrackedFile(communityId, f));
            } else if (data && typeof data === 'object' && (data.fileId || data.fileName)) {
              const file: CommunityFile = {
                id: data.fileId || data.id || '',
                fileName: data.fileName || 'Unknown',
                contentType: data.contentType,
                size: data.size,
                uploadedAt: data.uploadedAt
              };
              this.files = [file];
              this.addTrackedFile(communityId, file);
            } else {
              this.files = [];
            }
          } else {
            this.files = [];
          }
        },
        error: () => {
          this.filesLoading = false;
          this.files = [];
        }
      });
    } else {
      // We have tracked files — show them immediately
      this.files = tracked;
      this.filesLoading = false;
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const communityId = this.activeCommunityId;
    if (!communityId) return;

    this.uploadingFile = true;
    this.uploadProgress = 10;

    // Step 1: Get SAS URL
    const sasBody = { fileNames: [file.name] };
    
    this.communityService.getCommunityStorageSas(communityId, sasBody).subscribe({
      next: (res: any) => {
        this.uploadProgress = 30;
        
        const writeSasUri = res.data?.writeSasUris?.[file.name];
        
        if (!writeSasUri) {
          this.uploadingFile = false;
          this.uploadProgress = 0;
          this.showToast('error', 'Failed to get upload authorization.');
          return;
        }

        // Step 2: Upload directly to Azure Blob Storage
        this.uploadProgress = 40;
        this.storageService.uploadToAzure(file, writeSasUri).subscribe({
          next: () => {
            this.uploadProgress = 75;
            
            // Step 3: Register the file with backend
            this.communityService.listCommunityFiles(communityId, file.name).subscribe({
              next: (registerRes: any) => {
                this.uploadProgress = 100;
                this.uploadingFile = false;

                // Extract file info from registration response and add to list
                const newFile: CommunityFile = {
                  id: registerRes?.data?.fileId || registerRes?.data?.id || crypto.randomUUID(),
                  fileName: file.name,
                  contentType: file.type,
                  size: file.size,
                  uploadedAt: new Date().toISOString()
                };

                // Add to tracked files and update UI
                this.addTrackedFile(communityId, newFile);
                this.files = this.getTrackedFiles(communityId);

                this.showToast('success', `${file.name} uploaded successfully!`);
                input.value = '';
              },
              error: () => {
                this.uploadProgress = 100;
                this.uploadingFile = false;

                // Even if registration fails, the file IS uploaded to Azure
                const newFile: CommunityFile = {
                  id: crypto.randomUUID(),
                  fileName: file.name,
                  contentType: file.type,
                  size: file.size,
                  uploadedAt: new Date().toISOString()
                };

                this.addTrackedFile(communityId, newFile);
                this.files = this.getTrackedFiles(communityId);

                this.showToast('success', `${file.name} uploaded!`);
                input.value = '';
              }
            });
          },
          error: (err) => {
            this.uploadingFile = false;
            this.uploadProgress = 0;
            this.showToast('error', `Upload failed: ${err.message || 'Azure upload error'}`);
          }
        });
      },
      error: (err) => {
        this.uploadingFile = false;
        this.uploadProgress = 0;
        this.showToast('error', `Failed to obtain upload token: ${err.error?.message || err.message || 'API error'}`);
      }
    });
  }

  downloadFile(file: CommunityFile) {
    if (!this.activeCommunityId) return;

    this.communityService.downloadCommunityFile(this.activeCommunityId, file.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.fileName;
        link.click();
        window.URL.revokeObjectURL(url);
        this.showToast('success', 'File downloaded successfully!');
      },
      error: (err) => {
        // If API download fails, try using SAS read URL instead
        this.communityService.getCommunityStorageSas(this.activeCommunityId!, { fileNames: [file.fileName] }).subscribe({
          next: (sasRes: any) => {
            const readUrl = sasRes.data?.readSasUris?.[file.fileName];
            if (readUrl) {
              const link = document.createElement('a');
              link.href = readUrl;
              link.download = file.fileName;
              link.target = '_blank';
              link.click();
              this.showToast('success', 'File download started!');
            } else {
              this.showToast('error', `Download failed: ${err.message || 'Error downloading file'}`);
            }
          },
          error: () => {
            this.showToast('error', `Download failed: ${err.message || 'Error downloading file'}`);
          }
        });
      }
    });
  }

  deleteFile(fileId: string) {
    if (!this.activeCommunityId) return;

    if (!confirm('Are you sure you want to delete this file?')) return;

    this.communityService.deleteCommunityFile(this.activeCommunityId, fileId).subscribe({
      next: (res) => {
        // Remove from tracking and update UI regardless of API response
        this.removeTrackedFile(this.activeCommunityId!, fileId);
        this.files = this.getTrackedFiles(this.activeCommunityId!);
        this.showToast('success', 'File deleted successfully!');
      },
      error: (err) => {
        // Still remove from local tracking (file may have been deleted server-side)
        this.removeTrackedFile(this.activeCommunityId!, fileId);
        this.files = this.getTrackedFiles(this.activeCommunityId!);
        this.showToast('success', 'File removed from list.');
      }
    });
  }

  // ─── PHOTO UPLOADS (COMMUNITY PHOTO) ────────────────

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const communityId = this.activeCommunityId;
    if (!communityId) return;

    this.photoUploading = true;
    this.communityService.uploadCommunityPhoto(communityId, file).subscribe({
      next: (res) => {
        this.photoUploading = false;
        if (res.isSuccess) {
          this.showToast('success', 'Community photo updated!');
          if (this.selectedDetail) {
            this.selectedDetail.photoUrl = res.data;
          }
          this.load();
        } else {
          this.showToast('error', res.message || 'Failed to upload photo');
        }
      },
      error: (err) => {
        this.photoUploading = false;
        this.showToast('error', `Photo upload failed: ${err.message}`);
      }
    });
  }

  deletePhoto() {
    const communityId = this.activeCommunityId;
    if (!communityId) return;

    this.photoUploading = true;
    this.communityService.deleteCommunityPhoto(communityId).subscribe({
      next: (res) => {
        this.photoUploading = false;
        if (res.isSuccess) {
          this.showToast('success', 'Community photo deleted!');
          if (this.selectedDetail) {
            this.selectedDetail.photoUrl = undefined;
            this.selectedDetail.photoId = undefined;
          }
          this.load();
        } else {
          this.showToast('error', res.message || 'Failed to delete photo');
        }
      },
      error: (err) => {
        this.photoUploading = false;
        this.showToast('error', `Photo deletion failed: ${err.message}`);
      }
    });
  }

  // ─── HELPERS ───────────────────────────────────────

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

  formatSize(bytes?: number): string {
    if (!bytes && bytes !== 0) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  showToast(type: 'success' | 'error', message: string) {
    this.toast = { type, message, visible: true };
    setTimeout(() => {
      this.toast.visible = false;
    }, 3000);
  }

  resolvePhotoUrl(url?: string): string | undefined {
    if (!url) return undefined;
    // Rewrite absolute backend URLs to go through proxy
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url.replace('http://graduation-test.runasp.net', environment.apiUrl);
    }
    // Ensure it goes through the proxy path /api
    if (url.startsWith(environment.apiUrl)) {
      return url;
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${environment.apiUrl}${cleanUrl}`;
  }
}

