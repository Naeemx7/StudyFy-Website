import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StorageService } from '../../services/storage.service';
import { SpaceService } from '../../services/space.service';
import { AuthService } from '../../services/auth.service';
import { AnalyticsService } from '../../services/analytics.service';
import { UploadProgress } from '../../models/storage.models';

interface RoadmapFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt?: Date;
}

@Component({
  selector: 'app-roadmap',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './roadmap.html',
  styleUrl: './roadmap.css',
})
export class RoadmapComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private storageService = inject(StorageService);
  private spaceService = inject(SpaceService);
  private auth = inject(AuthService);
  private analyticsService = inject(AnalyticsService);

  spaceTitle = '';
  spaceSubtitle = '';
  spaceId = '';

  files: RoadmapFile[] = [];
  uploadProgress: UploadProgress[] = [];
  isUploading = false;
  loadingFiles = false;
  errorMessage = '';

  isDragActive = false;
  private dragCounter = 0;

  // New UI states
  currentUser$ = this.auth.currentUser$;
  streak = 0;
  totalQuizzes = 0;
  avatarDropdownOpen = false;
  navPhotoUrl: string | null = null;
  private lastPhotoId: string | undefined;
  private userSub?: Subscription;
  private spaceSub?: Subscription;

  ngOnInit(): void {
    this.spaceId = this.route.snapshot.paramMap.get('spaceId') || '';

    if (!this.spaceId) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Load space info
    this.spaceService.getSpace(this.spaceId).subscribe({
      next: (space) => {
        this.spaceTitle = space.title;
        this.spaceSubtitle = space.description;
        this.totalQuizzes = space.totalQuizzes ?? 0;
      },
      error: () => {
        this.spaceTitle = 'Study Space';
      }
    });

    this.loadFilesFromStorage();

    this.storageService.uploadProgress$.subscribe(progress => {
      this.uploadProgress = progress;
    });

    // Load analytics for streak
    this.analyticsService.getGlobalAnalytics().subscribe({
      next: (data) => {
        this.streak = data.currentStreak ?? 0;
      }
    });

    // Handle user photo
    this.userSub = this.auth.currentUser$.subscribe(user => {
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
    this.userSub?.unsubscribe();
    this.spaceSub?.unsubscribe();
    if (this.navPhotoUrl) URL.revokeObjectURL(this.navPhotoUrl);
  }

  // ===== UI Helpers for Topbar =====
  getDisplayName(name: string | undefined): string {
    if (!name) return 'User';
    if (name.includes('@')) return name.split('@')[0];
    return name;
  }

  getInitials(name: string | undefined): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
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

  // ===== Upload =====
  openPicker(input: HTMLInputElement) {
    input.click();
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent) {
    event.preventDefault();
    if (!this.hasFiles(event)) return;
    this.dragCounter += 1;
    this.isDragActive = true;
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent) {
    event.preventDefault();
    if (!this.hasFiles(event)) return;
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) this.isDragActive = false;
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent) {
    event.preventDefault();
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(event: DragEvent) {
    event.preventDefault();
    this.dragCounter = 0;
    this.isDragActive = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    this.addFiles(Array.from(files));
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragCounter = 0;
    this.isDragActive = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    this.addFiles(Array.from(files));
  }

  private hasFiles(event: DragEvent) {
    return event.dataTransfer?.types?.includes('Files') ?? false;
  }

  private addFiles(selected: File[]) {
    if (selected.length === 0) return;

    this.isUploading = true;
    this.errorMessage = '';

    this.storageService.uploadFiles(this.spaceId, selected).subscribe({
      next: (fileNames) => {
        const registrations = fileNames.map(name =>
          this.storageService.getFileContent(this.spaceId, name).pipe(
            catchError(() => of(null))
          )
        );

        forkJoin(registrations).subscribe(results => {
          const mapped: RoadmapFile[] = selected.map((f, i) => ({
            id: results[i]?.fileId ?? f.name,
            name: f.name,
            size: f.size,
            type: f.type || 'application/octet-stream',
            uploadedAt: new Date(),
          }));

          this.files = [...this.files, ...mapped];
          this.saveFilesToStorage();
          this.isUploading = false;
          this.storageService.clearProgress();
        });
      },
      error: (err) => {
        this.isUploading = false;
        this.errorMessage = err.message || 'Upload failed';
        this.storageService.clearProgress();
      }
    });
  }

  removeFile(id: string, ev?: MouseEvent) {
    ev?.stopPropagation();
    
    const originalFiles = [...this.files];
    this.files = this.files.filter((f) => f.id !== id);
    this.saveFilesToStorage();

    this.storageService.deleteFile(this.spaceId, id).subscribe({
      next: () => console.log('File deleted from backend'),
      error: (err) => {
        console.error('Failed to delete file:', err);
        this.files = originalFiles;
        this.saveFilesToStorage();
        this.errorMessage = 'Failed to delete file from server';
      }
    });
  }

  // ===== Navigation =====
  openWorkspace(file: RoadmapFile) {
    this.router.navigate(['/workspace', this.spaceId], { queryParams: { file: file.name } });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // ===== UI helpers =====
  formatSize(bytes: number) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  getFileIcon(type: string): string {
    if (type.includes('pdf')) return '📄';
    if (type.includes('audio')) return '🎵';
    if (type.includes('image')) return '🖼️';
    if (type.includes('video')) return '🎬';
    if (type.includes('text') || type.includes('document')) return '📝';
    return '📎';
  }

  get totalCount() {
    return this.files.length;
  }

  getUploadProgressFor(fileName: string): number {
    const p = this.uploadProgress.find(up => up.fileName === fileName);
    return p ? p.progress : 0;
  }

  trackById(_: number, file: RoadmapFile) {
    return file.id;
  }

  // ===== LocalStorage persistence =====
  private get storageKey(): string {
    return `asc_files_${this.spaceId}`;
  }

  private saveFilesToStorage(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.files));
  }

  private loadFilesFromStorage(): void {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.files = JSON.parse(saved);
      } catch {
        this.files = [];
      }
    }
  }
}
