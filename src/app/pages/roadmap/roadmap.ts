import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { SpaceService } from '../../services/space.service';
import { UploadProgress } from '../../models/storage.models';

interface RoadmapFile {
  id: string;        // fileId from backend (or temp id before content extraction)
  name: string;
  size: number;
  type: string;
  uploadedAt?: Date;
}

@Component({
  selector: 'app-roadmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roadmap.html',
  styleUrl: './roadmap.css',
})
export class RoadmapComponent implements OnInit {
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

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private storageService: StorageService,
    private spaceService: SpaceService
  ) {}

  ngOnInit(): void {
    // Get spaceId from route params
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
      },
      error: () => {
        this.spaceTitle = 'Study Space';
      }
    });

    // Load saved files from localStorage
    this.loadFilesFromStorage();

    // Subscribe to upload progress
    this.storageService.uploadProgress$.subscribe(progress => {
      this.uploadProgress = progress;
    });
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

    // Upload files via StorageService (real Azure upload)
    this.storageService.uploadFiles(this.spaceId, selected).subscribe({
      next: (fileNames) => {
        // Add uploaded files to the list
        const mapped: RoadmapFile[] = selected.map((f) => ({
          id: f.name,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          uploadedAt: new Date(),
        }));

        this.files = [...this.files, ...mapped];
        this.saveFilesToStorage();
        this.isUploading = false;
        this.storageService.clearProgress();
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
    this.files = this.files.filter((f) => f.id !== id);
    this.saveFilesToStorage();
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
