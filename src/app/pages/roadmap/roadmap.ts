import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

type FileStatus = 'MASTERED' | 'IN_PROGRESS' | 'NEEDS_REVIEW';

interface RoadmapFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  progress: number; // 0 - 100
  description?: string;
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

  files: RoadmapFile[] = [];

  isDragActive = false;
  private dragCounter = 0;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.files = [
      {
        id: crypto.randomUUID(),
        name: 'Intro to Processes.pdf',
        size: 1024,
        type: 'application/pdf',
        status: 'MASTERED',
        progress: 92,
        description: 'Covers PCB, process states, and context switching fundamentals.',
      },
      {
        id: crypto.randomUUID(),
        name: 'CPU Scheduling.pdf',
        size: 1024,
        type: 'application/pdf',
        status: 'MASTERED',
        progress: 85,
        description: 'FCFS, SJF, Priority, and Round Robin algorithms explained.',
      },
      {
        id: crypto.randomUUID(),
        name: 'Virtual Memory.pdf',
        size: 1024,
        type: 'application/pdf',
        status: 'IN_PROGRESS',
        progress: 45,
        description: 'Paging, segmentation, and page replacement strategies.',
      },
      {
        id: crypto.randomUUID(),
        name: 'Memory Management.pdf',
        size: 1024,
        type: 'application/pdf',
        status: 'NEEDS_REVIEW',
        progress: 38,
        description: 'Allocation strategies, fragmentation, and compaction.',
      },
    ];
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
    const mapped: RoadmapFile[] = selected.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
      status: 'IN_PROGRESS',
      progress: 0,
      description: 'Click to open the AI Workspace.',
    }));

    this.files = [...this.files, ...mapped];
  }

  removeFile(id: string, ev?: MouseEvent) {
    ev?.stopPropagation();
    this.files = this.files.filter((f) => f.id !== id);
  }

  // ===== Navigation =====
  openWorkspace(file: RoadmapFile) {
    this.router.navigate(['/workspace', file.id]);
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

  statusIconBg(status: FileStatus) {
    if (status === 'MASTERED') return 'bg-emerald-600';
    if (status === 'IN_PROGRESS') return 'bg-amber-600';
    return 'bg-rose-600';
  }

  borderClass(status: FileStatus) {
    if (status === 'MASTERED') return 'border-emerald-300';
    if (status === 'IN_PROGRESS') return 'border-amber-300';
    return 'border-rose-300';
  }

  barClass(status: FileStatus) {
    if (status === 'MASTERED') return 'bg-emerald-600';
    if (status === 'IN_PROGRESS') return 'bg-amber-600';
    return 'bg-rose-600';
  }

  get needsAttentionFile() {
    return this.files.find((f) => f.status === 'NEEDS_REVIEW') ?? null;
  }

  get masteredCount() {
    return this.files.filter((f) => f.status === 'MASTERED').length;
  }

  get totalCount() {
    return this.files.length;
  }

  get overallPercent() {
    if (this.totalCount === 0) return 0;
    return Math.round((this.masteredCount / this.totalCount) * 100);
  }

  get inProgressCount() {
    return this.files.filter((f) => f.status === 'IN_PROGRESS').length;
  }

  get needsReviewCount() {
    return this.files.filter((f) => f.status === 'NEEDS_REVIEW').length;
  }

  trackById(_: number, file: RoadmapFile) {
    return file.id;
  }
}
