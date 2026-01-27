import { Injectable } from '@angular/core';

export type RoadmapStatus = 'IN_PROGRESS' | 'MASTERED' | 'NEEDS_REVIEW';

export interface RoadmapFile {
  id: string;
  name: string;
  type: string;
  size: number; // bytes
  progress: number; // 0 - 100 (ده اللي يتحكم في status)
  status: RoadmapStatus;
  description?: string;
}

const STORAGE_KEY = 'roadmap_files_v1';

@Injectable({ providedIn: 'root' })
export class RoadmapService {
  getFiles(): RoadmapFile[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as RoadmapFile[];
    } catch {
      return [];
    }
  }

  saveFiles(files: RoadmapFile[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }

  addFiles(nativeFiles: File[]) {
    const current = this.getFiles();

    const mapped: RoadmapFile[] = nativeFiles.map((f) => {
      const id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
      return {
        id,
        name: f.name,
        type: f.type || 'unknown',
        size: f.size,
        progress: 0,
        status: this.deriveStatus(0),
        description: '',
      };
    });

    const next = [...current, ...mapped];
    this.saveFiles(next);
    return next;
  }

  removeFile(id: string) {
    const next = this.getFiles().filter((f) => f.id !== id);
    this.saveFiles(next);
    return next;
  }

  updateProgress(id: string, progress: number) {
    const next = this.getFiles().map((f) => {
      if (f.id !== id) return f;
      const nextProgress = this.clampProgress(progress);
      return { ...f, progress: nextProgress, status: this.deriveStatus(nextProgress) };
    });
    this.saveFiles(next);
    return next;
  }

  private clampProgress(value: number) {
    return Math.max(0, Math.min(100, value));
  }

  private deriveStatus(progress: number): RoadmapStatus {
    if (progress >= 80) return 'MASTERED';
    if (progress < 50) return 'NEEDS_REVIEW';
    return 'IN_PROGRESS';
  }
}
