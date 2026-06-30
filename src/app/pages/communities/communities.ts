import { Component, DestroyRef, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunityService } from '../../services/community.service';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { SpaceService } from '../../services/space.service';
import { ChatService } from '../../services/chat.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  Community,
  LeaderboardEntry,
  CreateCommunityRequest,
  Post,
  CommunityFile,
} from '../../models/community.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';


@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './communities.html',
  styleUrls: ['./communities.css']
})
export class CommunitiesComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private communityService = inject(CommunityService);
  private storageService = inject(StorageService);
  private authService = inject(AuthService);
  private spaceService = inject(SpaceService);
  private chatService = inject(ChatService);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  // Profile Dropdown state
  currentUser$ = this.authService.currentUser$;
  navPhotoUrl: string | null = null;
  lastPhotoId?: string;
  settingsDropdownOpen = false;
  avatarDropdownOpen = false;
  currentUserName: string | null = null;

  // AI reply state
  aiReplyLoading = false;

  communities$ = this.communityService.communities$;
  loading = false;
  searchTerm = '';
  activeCommunityId: string | null = null;
  communitiesCache: Community[] = [];

  // UI helper properties
  streakDays = 0;
  userInitial = '?';
  communityPhotoPreview: string | null = null;

  // Tab management
  activeTab: 'members' | 'leaderboard' | 'posts' | 'files' = 'members';

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
  files: (CommunityFile & { postId?: string; authorUserId?: string })[] = [];
  filesLoading = false;
  uploadingFile = false;
  uploadProgress = 0;
  uploadStatusText = 'Uploading file...';

  // Settings/Photo State
  photoUploading = false;
  allowFilesLoading = false;

  // Delete loading states
  deletePostLoadingId: string | null = null;
  deleteReplyLoadingId: string | null = null;

  // Modal visibility
  showCreateModal = false;
  showJoinModal = false;
  showSettingsModal = false;
  showNewPostModal = false;
  showDeleteConfirmModal = false;
  communityToDelete: { id: string; name: string } | null = null;

  // Detail sub-tab
  activeOverviewTab: 'members' | 'leaderboard' = 'members';

  get totalCommunityXp(): number {
    return this.leaderboard.reduce((sum, e) => sum + (e.xp || 0), 0);
  }

  getMemberColor(index: number): string {
    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#007184'];
    return colors[(index - 1 + colors.length) % colors.length];
  }

  getFileIconBg(fileName: string): string {
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    const map: Record<string, string> = {
      pdf: 'bg-red-400', doc: 'bg-blue-500', docx: 'bg-blue-500',
      xls: 'bg-green-500', xlsx: 'bg-green-500', csv: 'bg-green-500',
      ppt: 'bg-orange-400', pptx: 'bg-orange-400',
      png: 'bg-purple-400', jpg: 'bg-purple-400', jpeg: 'bg-purple-400', gif: 'bg-purple-400',
    };
    return map[ext] ?? 'bg-gray-400';
  }

  getFileIconBgLight(fileName: string): string {
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    const map: Record<string, string> = {
      pdf: 'bg-[#fef2f2]', doc: 'bg-[#eff6ff]', docx: 'bg-[#eff6ff]',
      xls: 'bg-[#f0fdf4]', xlsx: 'bg-[#f0fdf4]', csv: 'bg-[#f0fdf4]',
      ppt: 'bg-[#fff7ed]', pptx: 'bg-[#fff7ed]',
      png: 'bg-[#f3e8ff]', jpg: 'bg-[#f3e8ff]', jpeg: 'bg-[#f3e8ff]', gif: 'bg-[#f3e8ff]',
    };
    return map[ext] ?? 'bg-[#f2f4f4]';
  }

  getFileIconColor(fileName: string): string {
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    const map: Record<string, string> = {
      pdf: 'text-red-500', doc: 'text-blue-500', docx: 'text-blue-500',
      xls: 'text-green-600', xlsx: 'text-green-600', csv: 'text-green-600',
      ppt: 'text-orange-500', pptx: 'text-orange-500',
      png: 'text-purple-500', jpg: 'text-purple-500', jpeg: 'text-purple-500', gif: 'text-purple-500',
    };
    return map[ext] ?? 'text-gray-500';
  }

  getFileIconPath(fileName: string): string {
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    const map: Record<string, string> = {
      pdf: 'assets/communities/icon-file-pdf.svg',
      doc: 'assets/communities/icon-file-doc.svg',
      docx: 'assets/communities/icon-file-doc.svg',
      xls: 'assets/communities/icon-file-csv.svg',
      xlsx: 'assets/communities/icon-file-csv.svg',
      csv: 'assets/communities/icon-file-csv.svg',
      png: 'assets/communities/icon-file-png.svg',
      jpg: 'assets/communities/icon-file-png.svg',
      jpeg: 'assets/communities/icon-file-png.svg',
      gif: 'assets/communities/icon-file-png.svg',
    };
    return map[ext] ?? 'assets/communities/icon-file-doc.svg';
  }


  get currentUserId(): string | null {
    return this.authService.getCurrentUserId();
  }

  /** True when post content is a JSON file-metadata blob from a [Shared File] post */
  isSharedFilePost(input: string | any): boolean {
    // Accept either a raw content string or a Post object
    const content: string = typeof input === 'string' ? input : (input?.content ?? '');
    if (typeof input !== 'string' && input?.title) {
      // Legacy check: post object — check title prefix too
      if ((input.title as string).startsWith('[Shared File]')) return true;
    }
    const trimmed = (content ?? '').trim();
    return trimmed.startsWith('{') && trimmed.includes('"fileName"');
  }

  /** Parse the JSON file metadata from a shared-file post content string */
  parseSharedFileContent(content: string): { fileName: string; size?: number; contentType?: string } | null {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /** Format bytes into human-readable size string */
  formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** True if this reply is from the post author */
  isPostAuthor(reply: any): boolean {
    return !!this.selectedPost && reply.authorUserId === this.selectedPost.authorUserId;
  }

  /** Get top-level replies (no parent) */
  getTopLevelReplies(replies: any[]): any[] {
    return replies.filter(r => !r.parentReplyId);
  }

  /** Get child replies of a given parent */
  getChildReplies(replies: any[], parentId: string): any[] {
    return replies.filter(r => r.parentReplyId === parentId);
  }

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

    // Load streak + user initial from AuthService
    const user = this.authService.getCurrentUser?.();
    if (user) {
      this.streakDays = 0;
      this.userInitial = (user.userName ?? user.email ?? '?')[0].toUpperCase();
      this.currentUserName = user.userName ?? null;
    }

    // Handle current user profile photo subscription
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(u => {
        if (u?.photoId && u.photoId !== this.lastPhotoId) {
          this.lastPhotoId = u.photoId;
          this.authService.fetchProfilePhoto().subscribe({
            next: url => { this.navPhotoUrl = url; },
            error: () => { this.navPhotoUrl = null; }
          });
        } else if (!u?.photoId && this.lastPhotoId) {
          this.lastPhotoId = undefined;
          if (this.navPhotoUrl) URL.revokeObjectURL(this.navPhotoUrl);
          this.navPhotoUrl = null;
        }
      });

    this.load();
  }

  ngOnDestroy(): void {
    if (this.navPhotoUrl) {
      URL.revokeObjectURL(this.navPhotoUrl);
    }
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
    if (this.settingsDropdownOpen) {
      this.settingsDropdownOpen = false;
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getDisplayName(name: string | undefined): string {
    if (!name) return 'User';
    if (name.includes('@')) return name.split('@')[0];
    return name;
  }

  getInitials(name: string | undefined): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  getCommunityColor(name: string): string {
    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#007184'];
    if (!name) return colors[0];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  }

  getCommunityInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
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
    let list = communities ?? [];
    const term = this.searchTerm.trim().toLowerCase();

    if (term) {
      list = list.filter(community =>
        (community.name ?? '').toLowerCase().includes(term) ||
        (community.description ?? '').toLowerCase().includes(term) ||
        (community.joinCode ?? '').toLowerCase().includes(term)
      );
    }

    return list;
  }

  // ─── TABS ──────────────────────────────────────────

  switchTab(tab: 'members' | 'leaderboard' | 'posts' | 'files') {
    this.activeTab = tab;
    const communityId = this.activeCommunityId;
    if (!communityId) return;

    if (tab === 'members' || tab === 'leaderboard') {
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
          this.showCreateModal = false;
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
          this.showJoinModal = false;
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
    const community = this.communitiesCache.find(c => c.id === id) || this.selectedDetail;
    this.communityToDelete = { id, name: community?.name ?? 'this community' };
    this.showDeleteConfirmModal = true;
    this.showSettingsModal = false;
  }

  confirmDelete() {
    if (!this.communityToDelete) return;
    const { id } = this.communityToDelete;
    this.showDeleteConfirmModal = false;
    this.deleteLoadingId = id;
    this.communityService.deleteCommunity(id).subscribe({
      next: () => {
        this.deleteLoadingId = null;
        this.communityToDelete = null;
        if (this.activeCommunityId === id) this.clearSelected();
        this.showToast('success', 'Community deleted successfully!');
      },
      error: (err) => {
        if (err?.status === 500) {
          this.communityService.leaveCommunity(id).subscribe({
            next: () => {
              this.deleteLoadingId = null;
              this.communityToDelete = null;
              if (this.activeCommunityId === id) this.clearSelected();
              this.load();
              this.showToast('success', 'Removed from your communities.');
            },
            error: () => {
              this.deleteLoadingId = null;
              this.communityToDelete = null;
              this.showToast('error', 'Delete failed and fallback removal also failed.');
            }
          });
          return;
        }
        this.deleteLoadingId = null;
        this.communityToDelete = null;
        this.showToast('error', `Delete failed: ${err.message || 'Unknown error'}`);
      }
    });
  }

  // ─── DETAILS & LEADERBOARD ─────────────────────────

  viewDetail(id: string) {
    this.detailLoadingId = id;
    this.activeCommunityId = id;
    this.selectedDetail = null;
    this.activeTab = 'members';
    this.selectedPost = null;
    this.posts = [];
    this.files = [];
    this.leaderboard = [];

    this.communityService.getCommunityDetail(id).subscribe({
      next: res => {
        this.detailLoadingId = null;

        // The detail endpoint GET /communities/{communityId} is not user-scoped
        // so it does NOT return isAdmin. Merge it from the list cache so that
        // admin-only controls (photo upload, Settings tab) display correctly.
        const detail = res.data;
        if (detail) {
          const cached = this.communitiesCache.find(c => c.id === detail.id);
          if (cached?.isAdmin !== undefined) {
            detail.isAdmin = cached.isAdmin;
          }
        }

        this.selectedDetail = detail;
        this.activeCommunityId = detail?.id ?? id;
        this.showToast('success', 'Community details loaded!');

        // Prefetch basic lists and stats
        this.viewLeaderboard(this.activeCommunityId);
        this.loadPosts(this.activeCommunityId);
        this.loadFiles(this.activeCommunityId);
        // memberCount comes directly from the community detail response
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
    this.activeTab = 'members';
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

  // ─── MEMBER COUNT ──────────────────────────────────

  // ─── COMMUNITY SETTINGS ────────────────────────────

  toggleAllowFiles() {
    if (!this.activeCommunityId || !this.selectedDetail) return;
    const newValue = !this.selectedDetail.allowMembersToAddFiles;
    this.allowFilesLoading = true;
    this.communityService.updateCommunitySettings(this.activeCommunityId, newValue).subscribe({
      next: (res) => {
        this.allowFilesLoading = false;
        if (res.isSuccess) {
          this.selectedDetail!.allowMembersToAddFiles = newValue;
          this.showToast('success', `Members can ${newValue ? 'now' : 'no longer'} upload files.`);
        } else {
          this.showToast('error', res.message || 'Failed to update settings');
        }
      },
      error: (err) => {
        this.allowFilesLoading = false;
        this.showToast('error', `Settings update failed: ${err.message}`);
      }
    });
  }

  // ─── DELETE POST / REPLY ────────────────────────────

  removePost(post: Post) {
    if (!this.activeCommunityId) return;
    if (!confirm('Delete this post and all its replies?')) return;
    this.deletePostLoadingId = post.id;
    this.communityService.deletePost(this.activeCommunityId, post.id).subscribe({
      next: () => {
        this.deletePostLoadingId = null;
        this.posts = this.posts.filter(p => p.id !== post.id);
        if (this.selectedPost?.id === post.id) this.selectedPost = null;
        this.showToast('success', 'Post deleted.');
      },
      error: (err) => {
        this.deletePostLoadingId = null;
        this.showToast('error', `Failed to delete post: ${err.message}`);
      }
    });
  }

  /** Template-friendly wrapper: delete post by ID */
  deletePost(postId: string) {
    const post = this.posts.find(p => p.id === postId) || this.selectedPost;
    if (post) this.removePost(post);
  }

  removeReply(replyId: string) {
    if (!this.activeCommunityId || !this.selectedPost) return;
    if (!confirm('Delete this reply?')) return;
    this.deleteReplyLoadingId = replyId;
    this.communityService.deleteReply(this.activeCommunityId, this.selectedPost.id, replyId).subscribe({
      next: () => {
        this.deleteReplyLoadingId = null;
        if (this.selectedPost?.replies) {
          this.selectedPost.replies = this.selectedPost.replies.filter(r => r.id !== replyId);
          this.selectedPost.replyCount = Math.max(0, (this.selectedPost.replyCount || 0) - 1);
        }
        this.showToast('success', 'Reply deleted.');
      },
      error: (err) => {
        this.deleteReplyLoadingId = null;
        this.showToast('error', `Failed to delete reply: ${err.message}`);
      }
    });
  }

  /** Template-friendly wrapper: delete reply by postId + replyId */
  deleteReply(postId: string, replyId: string) {
    this.removeReply(replyId);
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

  onCommunityPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.communityPhotoPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removePostPhoto() {
    this.selectedPostPhoto = null;
  }

  createPost(communityId?: string) {
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
          this.showNewPostModal = false;
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

  backToDetail() {
    this.selectedPost = null;
    this.activeTab = 'posts';
  }

  createReply(postId?: string) {
    if (this.replyForm.invalid || !this.activeCommunityId || !this.selectedPost) return;

    const { content } = this.replyForm.value;
    const replyText = (content || '').trim();

    // ── @ai mention: ask the AI model ──────────────────
    if (replyText.toLowerCase().startsWith('@ai')) {
      this.handleAiReply(replyText);
      return;
    }

    // ── Normal reply ───────────────────────────────────
    this.createReplyLoading = true;

    this.communityService.createReply(
      this.activeCommunityId,
      this.selectedPost.id,
      { content: replyText }
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

  /**
   * Handle @ai mention in a reply.
   *
   * Flow:
   *  1. Post the user's @ai message as a visible reply.
   *  2. Extract the fileName from the shared-file post metadata.
   *  3. Call community storage/content to get the real fileId UUID.
   *  4. Use workspace auto-summarize with that fileId and fileName.
   *  5. Post the AI answer as a follow-up reply.
   */
  private handleAiReply(userText: string) {
    if (!this.activeCommunityId || !this.selectedPost) return;

    const communityId = this.activeCommunityId;
    const post = this.selectedPost;
    this.aiReplyLoading = true;
    this.createReplyLoading = true;
    this.replyForm.reset();

    // Step 1: Post the user's @ai message as a visible reply
    this.communityService.createReply(communityId, post.id, { content: userText }).subscribe({
      next: (res) => {
        if (res.isSuccess && res.data) {
          if (!post.replies) post.replies = [];
          post.replies.push(res.data);
          post.replyCount = (post.replyCount || 0) + 1;
        }

        // Step 2: Get fileName from the post metadata
        const meta = this.isSharedFilePost(post) ? this.parseFilePostContent(post.content) : null;
        const fileName: string | null = meta?.fileName || null;

        if (!fileName) {
          this.postAiError(communityId, post,
            'Please use @ai on a Shared File post so I can read the document and answer your question.');
          return;
        }

        // Step 3: Resolve the real fileId UUID from community storage/content
        this.callCommunityAi(communityId, post, fileName, userText);
      },
      error: () => {
        this.createReplyLoading = false;
        this.aiReplyLoading = false;
        this.showToast('error', 'Failed to post @ai reply.');
      }
    });
  }

  /**
   * Main AI dispatch for community files.
   *
   * Steps:
   *  A. Resolve the real fileId UUID via community storage/content endpoint.
   *  B. Fetch the user's workspaces (needed for the AI API routing).
   *  C. Try GET /users/{userId}/spaces/{workspaceId}/storage/auto-summarize?fileName=...
   *     This endpoint takes a fileName and generates an AI summary.
   *  D. If that fails, fall back to POST /spaces/{workspaceId}/summary with fileId.
   *  E. Post AI answer as a reply.
   */
  private callCommunityAi(communityId: string, post: Post, fileName: string, userText: string) {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      this.postAiError(communityId, post, 'You must be logged in to use @ai.');
      return;
    }

    const meta = this.isSharedFilePost(post) ? this.parseFilePostContent(post.content) : null;
    const metaFileId = meta?.fileId;
    const isUuid = (id: string | null) =>
      id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : false;

    if (isUuid(metaFileId)) {
      console.log('[AI] Found valid UUID in post metadata:', metaFileId);
      this.resolveWorkspaceAndCallAi(communityId, post, metaFileId, fileName, userId, userText);
    } else {
      console.log('[AI] File ID in metadata not a UUID. Resolving from storage content endpoint for fileName:', fileName);
      // Step A: Resolve real fileId UUID from community storage content endpoint
      const contentUrl = `${environment.apiUrl}/users/${userId}/communities/${communityId}/storage/content?fileName=${encodeURIComponent(fileName)}`;
      this.http.get<any>(contentUrl).subscribe({
        next: (contentRes) => {
          const fileId: string = contentRes?.data?.fileId || '';
          this.resolveWorkspaceAndCallAi(communityId, post, fileId, fileName, userId, userText);
        },
        error: () => {
          // content endpoint failed — proceed without fileId (AI will fail or handle)
          this.resolveWorkspaceAndCallAi(communityId, post, '', fileName, userId, userText);
        }
      });
    }
  }

  /**
   * Resolve the best workspace to use for AI calls on a community file.
   *
   * Community files live in community storage, not personal workspace storage.
   * The backend auto-creates a "<CommunityName> Workspace" for each community
   * and those files should be accessible via that workspace.
   * We therefore prefer the community workspace; only fall back to a personal
   * workspace if no community workspace is found.
   */
  private resolveWorkspaceAndCallAi(
    communityId: string, post: Post, fileId: string, fileName: string, userId: string, userText: string
  ) {
    // Community files are stored in the UPLOADER's namespace and indexed in their workspace.
    // If the current user is not the uploader, using our own workspace would fail with
    // "files not found". We load the post author's spaces instead.
    const fileAuthorId = post.authorUserId || userId;

    this.spaceService.loadSpacesForUser(fileAuthorId).subscribe({
      next: (spaces) => {
        if (!spaces || spaces.length === 0) {
          this.postAiError(communityId, post,
            'The file uploader\'s workspace could not be reached. Please try again later.');
          return;
        }

        const communityName = (this.selectedDetail?.name ?? '').trim().toLowerCase();
        const communityWorkspace = spaces.find(s => {
          const title = (s.title ?? '').trim().toLowerCase();
          return title === `${communityName} workspace` || title === communityName;
        });

        const workspaceId = communityWorkspace?.id ?? spaces[0].id;
        console.log('[AI] Using workspace:', workspaceId,
          communityWorkspace ? '(author community workspace)' : '(author personal fallback)',
          'authorId:', fileAuthorId);
        this.askAiQuestion(communityId, post, fileId, fileName, userId, workspaceId, userText, fileAuthorId);
      },
      error: () => {
        this.postAiError(communityId, post, 'Could not reach the AI service. Please try again.');
      }
    });
  }

  /**
   * Use chat sessions to answer custom questions about the community file.
   * @param fileAuthorId - the userId of the person who uploaded the file; all chat API
   *   calls use this ID in the URL path so the backend resolves files in the correct namespace.
   */
  private askAiQuestion(
    communityId: string, post: Post, fileId: string,
    fileName: string, userId: string, workspaceId: string, userText: string, fileAuthorId?: string
  ) {
    if (!fileId) {
      this.postAiError(communityId, post,
        'The AI could not access this community file. Make sure the file was uploaded correctly.');
      return;
    }

    const userQuestion = userText.replace(/^@ai\s*/i, '').trim();
    const query = userQuestion || 'Summarize this file and give me a recap of its contents.';

    // Use the file author's userId in the API path so the backend looks up files
    // in the correct storage namespace (not the current user's namespace).
    const authorId = fileAuthorId || userId;
    const sessionTitle = `Community AI - ${fileName}`;

    this.chatService.createSession(workspaceId, [fileId], sessionTitle, authorId).subscribe({
      next: (session) => {
        this.chatService.sendMessage(workspaceId, session.id, query, [fileId], authorId).subscribe({
          next: (chatRes) => {
            console.log('[AI] sendMessage success. Response:', chatRes);
            const replyText = chatRes?.assistantMessage?.content;
            if (replyText) {
              this.postAiReplyText(communityId, post, `🤖 **AI Response**\n\n${replyText}`);
            } else {
              this.postAiError(communityId, post, 'AI did not return an answer. Please try again.');
            }
            this.chatService.deleteSession(workspaceId, session.id, authorId).subscribe({
              error: (delErr) => console.warn('Could not clean up temporary chat session:', delErr)
            });
          },
          error: (err) => {
            console.error('[AI] sendMessage failed:', err);
            const msg = err?.error?.message || err?.message || 'AI failed to process this request.';
            this.postAiError(communityId, post, msg);
            this.chatService.deleteSession(workspaceId, session.id, authorId).subscribe();
          }
        });
      },
      error: (err) => {
        console.error('[AI] createSession failed:', err);
        const raw = err?.error?.message || err?.message || '';
        this.postAiError(communityId, post, raw || 'Failed to initialize AI session.');
      }
    });
  }

  private extractAiText(data: any): string {
    if (typeof data === 'string') return data;
    const content = data?.responseContent ?? data?.content ?? data;
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object') {
      return content.cleanContent || content.text || JSON.stringify(content, null, 2);
    }
    return JSON.stringify(data, null, 2);
  }

  private postAiReplyText(communityId: string, post: Post, text: string) {
    this.communityService.createReply(communityId, post.id, { content: text }).subscribe({
      next: (res) => {
        this.createReplyLoading = false;
        this.aiReplyLoading = false;
        if (res.isSuccess && res.data) {
          if (!post.replies) post.replies = [];
          post.replies.push(res.data);
          post.replyCount = (post.replyCount || 0) + 1;
          this.showToast('success', 'AI replied!');
        }
      },
      error: () => {
        this.createReplyLoading = false;
        this.aiReplyLoading = false;
        this.showToast('error', 'AI answered but could not post the reply.');
      }
    });
  }

  private postAiError(communityId: string, post: Post, errorMsg: string) {
    this.communityService.createReply(communityId, post.id, { content: `🤖 ${errorMsg}` }).subscribe({
      next: (res) => {
        this.createReplyLoading = false;
        this.aiReplyLoading = false;
        if (res.isSuccess && res.data) {
          if (!post.replies) post.replies = [];
          post.replies.push(res.data);
          post.replyCount = (post.replyCount || 0) + 1;
        }
      },
      error: () => {
        this.createReplyLoading = false;
        this.aiReplyLoading = false;
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

  private removeTrackedFile(communityId: string, fileId: string, fileName?: string) {
    const tracked = this.getTrackedFiles(communityId).filter(f => 
      f.id !== fileId && (!fileName || f.fileName !== fileName)
    );
    this.saveTrackedFiles(communityId, tracked);
  }

  // isSharedFilePost is defined above (unified method accepting string | Post)

  parseFilePostContent(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  downloadFileFromPost(post: Post) {
    const meta = this.parseFilePostContent(post.content);
    if (!meta) return;
    
    const file: CommunityFile & { authorUserId?: string } = {
      id: meta.fileId,
      fileName: meta.fileName,
      contentType: meta.contentType,
      size: meta.size,
      uploadedAt: meta.uploadedAt,
      authorUserId: post.authorUserId
    };
    this.downloadFile(file);
  }

  private createPostForFile(communityId: string, newFile: CommunityFile, readSasUri?: string) {
    const fileMetadata: any = {
      fileId: newFile.id,
      fileName: newFile.fileName,
      size: newFile.size,
      uploadedAt: newFile.uploadedAt || new Date().toISOString(),
      contentType: newFile.contentType || 'application/octet-stream',
      isCommunityFile: true
    };
    // Store a SAS read base URL (without the SAS token, which expires)
    // We'll request a fresh SAS token at download time

    this.communityService.createPost(
      communityId,
      `[Shared File] ${newFile.fileName}`,
      JSON.stringify(fileMetadata)
    ).subscribe({
      next: () => {
        this.loadFiles(communityId);
        this.loadPosts(communityId);
      },
      error: (err) => {
        console.error('Failed to create file post metadata:', err);
      }
    });
  }

  loadFiles(communityId: string) {
    this.filesLoading = true;

    // Load from localStorage tracking (since the API has no "list all" endpoint)
    const tracked = this.getTrackedFiles(communityId);

    this.communityService.listPosts(communityId).subscribe({
      next: (res) => {
        this.filesLoading = false;
        if (res.isSuccess && res.data) {
          const filePosts = (res.data || []).filter(p => this.isSharedFilePost(p));
          
          const postFiles = filePosts
            .filter(p => {
              // Check if any reply is "[File Deleted]"
              const isDeleted = p.replies && p.replies.some(r => r.content === '[File Deleted]');
              return !isDeleted;
            })
            .map(p => {
              const meta = this.parseFilePostContent(p.content);
              return {
                id: meta?.fileId || p.id,
                fileName: meta?.fileName || p.title.replace('[Shared File] ', ''),
                contentType: meta?.contentType || 'application/octet-stream',
                size: meta?.size || 0,
                uploadedAt: meta?.uploadedAt || p.createdAt,
                postId: p.id,
                authorUserId: p.authorUserId
              } as CommunityFile & { postId?: string; authorUserId?: string };
            });

          // Merge with localStorage tracking files (avoid duplicates by fileName)
          const merged = [...postFiles];
          tracked.forEach(localFile => {
            if (!merged.some(f => f.fileName === localFile.fileName)) {
              merged.push(localFile);
            }
          });

          this.files = merged;
          this.saveTrackedFiles(communityId, this.files);
        } else {
          this.files = tracked;
        }
      },
      error: () => {
        this.filesLoading = false;
        this.files = tracked;
      }
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const communityId = this.activeCommunityId;
    if (!communityId) return;

    this.uploadingFile = true;
    this.uploadProgress = 10;
    this.uploadStatusText = 'Obtaining upload token...';

    // Step 1: Get SAS URL
    const sasBody = { fileNames: [file.name] };
    
    this.communityService.getCommunityStorageSas(communityId, sasBody).subscribe({
      next: (res: any) => {
        this.uploadProgress = 30;
        this.uploadStatusText = 'Uploading file to storage...';

        const writeSasUri = res.data?.writeSasUris?.[file.name];

        if (!writeSasUri) {
          this.uploadingFile = false;
          this.uploadProgress = 0;
          this.showToast('error', 'Failed to get upload authorization.');
          return;
        }

        // Step 2: Upload directly to Azure Blob Storage
        this.uploadProgress = 50;
        this.storageService.uploadToAzure(file, writeSasUri).subscribe({
          next: () => {
            this.uploadProgress = 70;
            this.uploadStatusText = 'Registering file and extracting text...';

            // Step 3: Register the file with backend and retrieve real DB UUID
            this.communityService.listCommunityFiles(communityId, file.name).subscribe({
              next: (registerRes: any) => {
                this.uploadProgress = 100;
                this.uploadingFile = false;
                this.uploadStatusText = 'Upload complete!';
                console.log('[UP] listCommunityFiles response:', registerRes);

                let resolvedId = file.name;
                const rdata = registerRes?.data;
                if (rdata) {
                  if (Array.isArray(rdata)) {
                    const matched = rdata.find((f: any) => f.fileName === file.name);
                    resolvedId = matched?.id || matched?.fileId || rdata[0]?.id || rdata[0]?.fileId || file.name;
                  } else {
                    resolvedId = rdata.fileId || rdata.id || file.name;
                  }
                }
                console.log('[UP] Resolved file ID:', resolvedId);

                const newFile: CommunityFile & { authorUserId?: string } = {
                  id: resolvedId,
                  fileName: file.name,
                  contentType: file.type,
                  size: file.size,
                  uploadedAt: new Date().toISOString(),
                  authorUserId: this.authService.getCurrentUserId() || undefined
                };

                this.addTrackedFile(communityId, newFile);
                this.createPostForFile(communityId, newFile);
                this.showToast('success', `${file.name} uploaded successfully!`);
                input.value = '';
              },
              error: (err) => {
                console.warn('[UP] File registration failed but file is in Azure. Using fallback.', err);
                this.uploadProgress = 100;
                this.uploadingFile = false;
                this.uploadStatusText = 'Upload complete (text extraction skipped)!';

                const newFile: CommunityFile & { authorUserId?: string } = {
                  id: file.name,
                  fileName: file.name,
                  contentType: file.type,
                  size: file.size,
                  uploadedAt: new Date().toISOString(),
                  authorUserId: this.authService.getCurrentUserId() || undefined
                };

                this.addTrackedFile(communityId, newFile);
                this.createPostForFile(communityId, newFile);
                this.showToast('success', `${file.name} uploaded successfully!`);
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

  downloadFile(file: CommunityFile & { authorUserId?: string }) {
    if (!this.activeCommunityId) return;
    const communityId = this.activeCommunityId;
    const fileName = file.fileName;
    
    // Fallback: If authorUserId is missing, default to the current user's ID
    let authorUserId = file.authorUserId;
    if (!authorUserId) {
      authorUserId = this.authService.getCurrentUserId() || undefined;
    }

    console.log('[DL] Starting download for:', fileName, '| id:', file.id, '| authorUserId:', authorUserId);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(file.id);

    if (isUuid) {
      // PRIMARY: Download directly using the uploader's namespace
      const downloadUserId = authorUserId || this.authService.getCurrentUserId() || '';
      console.log('[DL] ID is a valid UUID. Attempting uploader-scoped download:', downloadUserId);
      
      this.communityService.downloadCommunityFileAsUser(downloadUserId, communityId, file.id).subscribe({
        next: (blob) => this.triggerBlobDownload(blob, fileName),
        error: (err) => {
          console.warn('[DL] Uploader-scoped download failed, trying current user scope...', err);
          
          // Fallback 1: Try current user namespace
          this.communityService.downloadCommunityFile(communityId, file.id).subscribe({
            next: (blob) => this.triggerBlobDownload(blob, fileName),
            error: (err2) => {
              console.warn('[DL] Direct API downloads failed. Trying SAS fallback...', err2);
              this.fallbackDownload(communityId, file, authorUserId);
            }
          });
        }
      });
    } else {
      console.log('[DL] ID is not a UUID (likely legacy filename). Using SAS fallbacks...');
      this.fallbackDownload(communityId, file, authorUserId);
    }
  }

  private fallbackDownload(communityId: string, file: CommunityFile, authorUserId?: string) {
    const fileName = file.fileName;

    if (authorUserId) {
      // PRIMARY: Try SAS with author's userId (creator can get SAS tokens)
      this.communityService.getCommunityStorageSasAsUser(authorUserId, communityId, { fileNames: [fileName] }).subscribe({
        next: (sasRes: any) => {
          console.log('[DL] Fallback SAS response:', sasRes);
          const readUrl = this.extractReadUrl(sasRes, fileName);
          if (readUrl) {
            this.downloadFromSasUrl(readUrl, fileName);
          } else {
            // SAS returned OK but no read URL → resolve fileId via author's scope
            this.resolveAndDownload(authorUserId, communityId, file);
          }
        },
        error: (err) => {
          console.warn('[DL] Fallback SAS failed, trying fileId resolution...', err);
          this.resolveAndDownload(authorUserId, communityId, file);
        }
      });
    } else {
      // No author info → try current user's endpoints
      this.downloadViaApi(communityId, file);
    }
  }

  /** Resolve real fileId using author's userId, then download */
  private resolveAndDownload(authorUserId: string, communityId: string, file: CommunityFile) {
    console.log('[DL] Resolving fileId via author:', authorUserId);
    this.communityService.listCommunityFilesAsUser(authorUserId, communityId, file.fileName).subscribe({
      next: (res: any) => {
        console.log('[DL] listCommunityFilesAsUser response:', res);
        let realFileId = null;
        const rdata = res?.data;
        if (rdata) {
          if (Array.isArray(rdata)) {
            const matched = rdata.find(f => f.fileName === file.fileName);
            realFileId = matched?.id || matched?.fileId || rdata[0]?.id || rdata[0]?.fileId || null;
          } else {
            realFileId = rdata.fileId || rdata.id || null;
          }
        }
        console.log('[DL] Resolved fileId from author scope:', realFileId);
        if (realFileId) {
          // Download using author's userId + resolved fileId
          this.communityService.downloadCommunityFileAsUser(authorUserId, communityId, realFileId).subscribe({
            next: (blob) => this.triggerBlobDownload(blob, file.fileName),
            error: (err) => {
              console.error('[DL] Download (author) failed:', err?.status);
              // Last resort: try with current user's userId
              this.downloadByFileId(communityId, realFileId, file.fileName);
            }
          });
        } else {
          // No fileId from author scope either → try stored id with current user
          this.downloadByFileId(communityId, file.id, file.fileName);
        }
      },
      error: () => {
        // Can't resolve via author → fall back to current user
        this.downloadViaApi(communityId, file);
      }
    });
  }

  /** Extract read URL from SAS response, trying exact match then fuzzy match */
  private extractReadUrl(sasRes: any, fileName: string): string | null {
    const data = sasRes?.data;
    if (!data) return null;

    console.log('[DL] Extracting URL from SAS response data:', JSON.stringify(data));

    // Helper to search an object recursively for a URL matching fileName
    const findUrl = (obj: any): string | null => {
      if (!obj) return null;
      if (typeof obj === 'string') {
        if (obj.startsWith('http') && (obj.toLowerCase().includes(fileName.toLowerCase()) || obj.includes('sig='))) {
          return obj;
        }
        return null;
      }
      if (typeof obj === 'object') {
        // Try exact match on keys first
        if (obj[fileName]) return obj[fileName];
        for (const k of Object.keys(obj)) {
          if (k.toLowerCase() === fileName.toLowerCase() && typeof obj[k] === 'string') {
            return obj[k];
          }
        }
        // Recursively check values
        for (const val of Object.values(obj)) {
          const found = findUrl(val);
          if (found) return found;
        }
      }
      return null;
    };

    // First try standard paths (including writeSasUris fallback)
    const standardUris = data.readSasUris || data.writeSasUris || data.readUris || data.writeUris;
    if (standardUris && typeof standardUris === 'object') {
      const keys = Object.keys(standardUris);
      if (standardUris[fileName]) return standardUris[fileName];
      const ciKey = keys.find(k => k.toLowerCase() === fileName.toLowerCase());
      if (ciKey) return standardUris[ciKey];
      const suffixKey = keys.find(k => k.endsWith(fileName) || k.endsWith('/' + fileName));
      if (suffixKey) return standardUris[suffixKey];
      if (keys.length === 1) return standardUris[keys[0]];
    }

    // Fall back to recursive search
    const found = findUrl(data);
    if (found) {
      console.log('[DL] Found matched SAS URL via recursive search:', found);
      return found;
    }

    return null;
  }

  /** Fetch the file bytes from an Azure SAS URL and trigger a browser download. */
  private downloadFromSasUrl(sasUrl: string, fileName: string) {
    fetch(sasUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Delay revoke so Chrome finishes writing to disk before the blob is released.
        setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
        this.showToast('success', 'File downloaded successfully!');
      })
      .catch(err => {
        console.error('[DL] SAS blob fetch failed:', err);
        this.showToast('error', 'Download failed. Please try again.');
      });
  }

  /** Trigger a browser file download from a Blob */
  private triggerBlobDownload(blob: Blob, fileName: string) {
    // Slice the first 1KB of the blob to check if it looks like a JSON response wrapper
    const slice = blob.slice(0, 1024);
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string || '').trim();
      if (text.startsWith('{')) {
        // It looks like JSON! Read the entire blob as text and try to parse it.
        const fullReader = new FileReader();
        fullReader.onload = () => {
          try {
            const res = JSON.parse(fullReader.result as string);
            console.log('[DL] Download response parsed as JSON:', res);

            if (res && typeof res === 'object' && typeof res.isSuccess === 'boolean') {
              if (res.isSuccess === false) {
                console.error('[DL] Download returned isSuccess: false:', res.message);
                this.showToast('error', res.message || 'Download failed: File not found.');
                return;
              }

              const data = res?.data;
              let downloadUrl = null;
              if (data) {
                if (typeof data === 'string') {
                  downloadUrl = data;
                } else if (typeof data === 'object') {
                  downloadUrl = data.url || data.downloadUrl || data.readSasUri || data[fileName] || data[fileName.toLowerCase()] || Object.values(data)[0];
                }
              }

              if (typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
                console.log('[DL] Found redirect URL inside JSON:', downloadUrl);
                this.downloadFromSasUrl(downloadUrl, fileName);
                return;
              }
            }
          } catch (e) {
            console.warn('[DL] Slice started with { but full text is not valid JSON:', e);
          }
          // Fallback if parsing failed or doesn't match API wrapper: download original blob directly
          this.triggerBlobDownloadDirect(blob, fileName);
        };
        fullReader.readAsText(blob);
      } else {
        // Not JSON, download the blob directly
        this.triggerBlobDownloadDirect(blob, fileName);
      }
    };
    reader.readAsText(slice);
  }

  private triggerBlobDownloadDirect(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoke after a delay — click() is non-blocking and Chrome writes the file
    // asynchronously. Revoking immediately truncates the blob before the OS
    // finishes saving it, producing an empty/corrupt file at the file:// path.
    setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
    this.showToast('success', 'File downloaded successfully!');
  }

  /** Fallback: try to download via the backend API using current user */
  private downloadViaApi(communityId: string, file: CommunityFile) {
    console.log('[DL] listCommunityFiles (current user) query for:', file.fileName);
    this.communityService.listCommunityFiles(communityId, file.fileName).subscribe({
      next: (res: any) => {
        console.log('[DL] listCommunityFiles (current user) response:', res);
        let realFileId = null;
        const rdata = res?.data;
        if (rdata) {
          if (Array.isArray(rdata)) {
            const matched = rdata.find(f => f.fileName === file.fileName);
            realFileId = matched?.id || matched?.fileId || rdata[0]?.id || rdata[0]?.fileId || null;
          } else {
            realFileId = rdata.fileId || rdata.id || null;
          }
        }
        console.log('[DL] Resolved fileId from current user scope:', realFileId);
        if (realFileId) {
          this.downloadByFileId(communityId, realFileId, file.fileName);
        } else {
          this.downloadByFileId(communityId, file.id, file.fileName);
        }
      },
      error: () => {
        this.downloadByFileId(communityId, file.id, file.fileName);
      }
    });
  }

  /** Download using the /files/{fileId}/download endpoint with current user */
  private downloadByFileId(communityId: string, fileId: string, fileName: string) {
    this.communityService.downloadCommunityFile(communityId, fileId).subscribe({
      next: (blob) => this.triggerBlobDownload(blob, fileName),
      error: (err) => {
        console.error('[DL] API download failed:', err?.status, err?.error);
        if (err?.error instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            console.error('[DL] API download error body:', reader.result);
          };
          reader.readAsText(err.error);
        }
        this.showToast('error', 'Download failed: File could not be retrieved from server.');
      }
    });
  }


  deleteFile(file: any) {
    if (!this.activeCommunityId) return;

    if (!confirm('Are you sure you want to delete this file?')) return;

    this.communityService.deleteCommunityFile(this.activeCommunityId, file.id).subscribe({
      next: () => {
        this.completeDeletion(file);
      },
      error: () => {
        // Still try to delete if error (file might not exist in backend storage anymore)
        this.completeDeletion(file);
      }
    });
  }

  private completeDeletion(file: any) {
    const communityId = this.activeCommunityId!;
    
    // Always remove from local tracking storage so it does not get re-merged
    this.removeTrackedFile(communityId, file.id, file.fileName);
    
    // Optimistically update the local files array so it disappears from UI immediately
    this.files = this.files.filter(f => f.id !== file.id && f.fileName !== file.fileName);

    if (file.postId) {
      this.communityService.createReply(communityId, file.postId, { content: '[File Deleted]' }).subscribe({
        next: () => {
          this.loadFiles(communityId);
          this.showToast('success', 'File deleted successfully!');
        },
        error: () => {
          this.loadFiles(communityId);
          this.showToast('success', 'File deleted.');
        }
      });
    } else {
      this.showToast('success', 'File deleted.');
    }
  }

  // ─── PHOTO UPLOADS (COMMUNITY PHOTO) ────────────────

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const communityId = this.activeCommunityId;
    if (!communityId) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.showToast('error', 'Photo must be under 5MB.');
      input.value = '';
      return;
    }

    this.photoUploading = true;
    this.communityService.uploadCommunityPhoto(communityId, file).subscribe({
      next: (res) => {
        this.photoUploading = false;
        input.value = ''; // Reset so same file can be re-selected
        if (res.isSuccess) {
          this.showToast('success', 'Community photo updated!');
          // Update local state immediately so photo renders without a full reload
          const photoUrl = typeof res.data === 'string' ? res.data : (res as any)?.data?.photoUrl || (res as any)?.data?.url;
          if (this.selectedDetail && photoUrl) {
            this.selectedDetail = { ...this.selectedDetail, photoUrl };
          }
          // Re-fetch community detail to get the authoritative photoUrl from backend
          this.viewDetail(communityId);
        } else {
          this.showToast('error', res.message || 'Failed to upload photo');
        }
      },
      error: (err) => {
        this.photoUploading = false;
        input.value = '';
        // Log full error body to help diagnose field name / format issues
        const errBody = err?.error;
        console.error('[Photo Upload] 400 error body:', errBody);
        const msg = errBody?.message || errBody?.title || errBody?.errors
          ? JSON.stringify(errBody?.errors || errBody?.message || errBody?.title)
          : err?.message || 'Unknown error';
        this.showToast('error', `Photo upload failed: ${msg}`);
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

