import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { StorageService } from '../../services/storage.service';
import { AiService } from '../../services/ai.service';
import { GeminiResponse, DifficultyLevel } from '../../models/ai.models';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  title?: string;
  timestamp: Date;
}

interface QuizFileOption {
  fileId: string;
  fileName: string;
  selected: boolean;
}

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class WorkspaceComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private storageService = inject(StorageService);
  private aiService = inject(AiService);

  // Route params
  spaceId = '';
  fileName = '';

  // File state
  fileContent = '';
  fileId = '';
  safePdfUrl: SafeResourceUrl | null = null;
  isPdf = false;
  loadingContent = true;
  loadingPdf = true;
  contentError = '';

  // Chat state
  messages: ChatMessage[] = [];
  isProcessing = false;
  processingAction = '';

  // Settings
  difficulty: DifficultyLevel = 'Medium';
  questionCount = 5;
  chatInput = '';
  private shouldScroll = false;

  // Quiz modal
  showQuizModal = false;
  quizFiles: QuizFileOption[] = [];

  ngOnInit(): void {
    this.spaceId = this.route.snapshot.paramMap.get('spaceId') || '';
    this.fileName = this.route.snapshot.paramMap.get('fileName') || '';

    if (!this.spaceId || !this.fileName) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.isPdf = this.fileName.toLowerCase().endsWith('.pdf');

    // Get read URL for PDF display
    if (this.isPdf) {
      this.loadPdfUrl();
    }

    // Get extracted text content (needed for AI operations)
    this.loadFileContent();
  }

  private loadPdfUrl(): void {
    this.loadingPdf = true;
    this.storageService.getReadUrl(this.spaceId, this.fileName).subscribe({
      next: (url) => {
        this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.loadingPdf = false;
      },
      error: () => {
        this.contentError = 'Could not load PDF preview';
        this.loadingPdf = false;
      }
    });
  }

  private loadFileContent(): void {
    this.loadingContent = true;
    this.storageService.getFileContent(this.spaceId, this.fileName).subscribe({
      next: (content) => {
        this.fileId = content.fileId;
        this.fileContent = typeof content.result === 'string'
          ? content.result
          : JSON.stringify(content.result, null, 2);
        this.loadingContent = false;
        // Persist the real UUID fileId back to localStorage
        this.updateFileIdInStorage(this.fileName, this.fileId);
      },
      error: (err) => {
        this.loadingContent = false;
        // If content extraction fails but we have a PDF, still show it
        if (this.isPdf) {
          this.contentError = '';
        } else {
          this.contentError = err.message || 'Failed to load file content';
        }
      }
    });
  }

  // ===== AI Actions =====

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.chatContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }

  onSendMessage(): void {
    const text = this.chatInput.trim();
    if (!text || this.isProcessing) return;
    this.chatInput = '';
    this.addMessage('user', text);
    // For now, quick actions based on keywords
    if (!this.fileId) {
      this.addMessage('ai', 'File is still loading. Please wait a moment and try again.');
      return;
    }
    const lower = text.toLowerCase();
    if (lower.includes('summar')) {
      this.onSummarize();
    } else if (lower.includes('flash')) {
      this.onFlashcards();
    } else if (lower.includes('quiz')) {
      this.onQuiz();
    } else {
      this.addMessage('ai', 'I can help you with summaries, flashcards, and quizzes. Try clicking one of the quick actions below, or ask me to "summarize", "generate flashcards", or "create a quiz".');
    }
  }

  onSummarize(): void {
    if (!this.fileId || this.isProcessing) return;

    this.isProcessing = true;
    this.processingAction = 'Generating summary...';
    this.addMessage('user', 'Summarize this document');

    this.aiService.generateSummary(this.spaceId, [this.fileId]).subscribe({
      next: (res) => this.handleAiResponse(res),
      error: (err) => this.handleAiError(err),
    });
  }

  onFlashcards(): void {
    if (!this.fileId || this.isProcessing) return;

    this.isProcessing = true;
    this.processingAction = 'Generating flashcards...';
    this.addMessage('user', `Generate ${this.questionCount} flashcards (${this.difficulty})`);

    this.aiService.generateFlashcards(this.spaceId, [this.fileId], this.difficulty, this.questionCount).subscribe({
      next: (res) => this.handleAiResponse(res),
      error: (err) => this.handleAiError(err),
    });
  }

  onQuiz(): void {
    // Load files from localStorage (same as roadmap saves them)
    const saved = localStorage.getItem(`asc_files_${this.spaceId}`);
    let files: { id: string; name: string }[] = [];
    if (saved) {
      try { files = JSON.parse(saved); } catch { files = []; }
    }

    // Ensure current file is in the list with its real fileId (UUID)
    const existing = files.find(f => f.name === this.fileName);
    if (existing) {
      if (this.fileId) existing.id = this.fileId;
    } else if (this.fileId) {
      files.push({ id: this.fileId, name: this.fileName });
    }

    this.quizFiles = files.map(f => ({
      fileId: f.id,
      fileName: f.name,
      selected: f.name === this.fileName,
    }));

    this.showQuizModal = true;
  }

  get selectedQuizFileCount(): number {
    return this.quizFiles.filter(f => f.selected).length;
  }

  startQuiz(): void {
    const selected = this.quizFiles.filter(f => f.selected);
    if (selected.length === 0) return;

    // Separate files with real UUIDs from those still using filename as id
    const ready = selected.filter(f => this.isUuid(f.fileId));
    const needsResolve = selected.filter(f => !this.isUuid(f.fileId));

    if (needsResolve.length === 0) {
      this.navigateToQuiz(ready.map(f => f.fileId));
      return;
    }

    // Resolve fileIds by fetching content for files without real UUIDs
    this.isProcessing = true;
    this.processingAction = 'Preparing quiz files...';

    const resolveRequests = needsResolve.map(f =>
      this.storageService.getFileContent(this.spaceId, f.fileName).pipe(
        map(content => content.fileId),
        catchError(() => of(null as string | null))
      )
    );

    forkJoin(resolveRequests).subscribe(resolvedIds => {
      this.isProcessing = false;
      this.processingAction = '';
      const validIds = resolvedIds.filter((id): id is string => !!id);
      const allIds = [...ready.map(f => f.fileId), ...validIds];

      if (allIds.length === 0) {
        this.addMessage('ai', 'Could not prepare files for quiz. Please try again.');
        return;
      }
      this.navigateToQuiz(allIds);
    });
  }

  private navigateToQuiz(fileIds: string[]): void {
    this.showQuizModal = false;
    this.router.navigate(['/quiz', this.spaceId], {
      queryParams: {
        fileIds: fileIds.join(','),
        difficulty: this.difficulty,
        count: this.questionCount,
        fileName: this.fileName,
      }
    });
  }

  private isUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  private updateFileIdInStorage(fileName: string, fileId: string): void {
    const key = `asc_files_${this.spaceId}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;
    try {
      const files = JSON.parse(saved);
      const file = files.find((f: any) => f.name === fileName);
      if (file && file.id !== fileId) {
        file.id = fileId;
        localStorage.setItem(key, JSON.stringify(files));
      }
    } catch {}
  }

  private handleAiResponse(res: GeminiResponse): void {
    this.isProcessing = false;
    this.processingAction = '';
    const content = typeof res.responseContent === 'string'
      ? res.responseContent
      : JSON.stringify(res.responseContent, null, 2);
    this.addMessage('ai', content, res.responseTitle);
  }

  private handleAiError(err: Error): void {
    this.isProcessing = false;
    this.processingAction = '';
    this.addMessage('ai', err.message || 'Something went wrong. Please try again.');
  }

  private addMessage(role: 'user' | 'ai', content: string, title?: string): void {
    this.messages.push({ role, content, title, timestamp: new Date() });
    this.shouldScroll = true;
  }

  // ===== Navigation =====

  goBack(): void {
    this.router.navigate(['/roadmap', this.spaceId]);
  }
}
