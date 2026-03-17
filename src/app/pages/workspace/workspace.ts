import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { StorageService } from '../../services/storage.service';
import { AiService } from '../../services/ai.service';
import { DifficultyLevel, GeminiResponse, QuizResponse } from '../../models/ai.models';

type WorkspaceTab = 'summary' | 'flashcards' | 'quiz';
type ContentState = 'idle' | 'loading' | 'ready' | 'error';
type QuizState = 'idle' | 'loading' | 'ready' | 'in-progress' | 'completed' | 'error';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  title?: string;
  timestamp: Date;
}

interface Flashcard {
  front: string;
  back: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
}

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class WorkspaceComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer?: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storageService = inject(StorageService);
  private aiService = inject(AiService);

  // Route params
  spaceId = '';
  fileName = '';

  // File state
  fileContent = '';
  fileTopic = '';
  fileId = '';
  isPdf = false;
  loadingContent = true;
  contentError = '';

  // Study tabs
  activeTab: WorkspaceTab = 'summary';
  summaryState: ContentState = 'idle';
  summaryTitle = '';
  summaryContent = '';
  summaryError = '';

  flashcardsState: ContentState = 'idle';
  flashcardsTitle = '';
  flashcards: Flashcard[] = [];
  flashcardsRawContent = '';
  flashcardsError = '';
  flashcardIndex = 0;
  flashcardShowsBack = false;

  quizState: QuizState = 'idle';
  quizId = '';
  quizError = '';
  quizQuestions: QuizQuestion[] = [];
  currentIndex = 0;
  score = 0;
  totalAnswered = 0;

  // Chat state
  messages: ChatMessage[] = [];
  isProcessing = false;
  processingAction = '';

  // Settings
  difficulty: DifficultyLevel = 'Medium';
  questionCount = 5;
  chatInput = '';
  private shouldScroll = false;

  ngOnInit(): void {
    this.spaceId = this.route.snapshot.paramMap.get('spaceId') || '';
    this.fileName = this.route.snapshot.paramMap.get('fileName') || '';

    if (!this.spaceId || !this.fileName) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.isPdf = this.fileName.toLowerCase().endsWith('.pdf');

    // Load extracted text content (works for all file types including PDFs)
    this.loadFileContent();
  }

  private loadFileContent(): void {
    this.loadingContent = true;
    this.storageService.getFileContent(this.spaceId, this.fileName).subscribe({
      next: (content) => {
        this.fileId = content.fileId;
        this.extractDisplayContent(content.result);
        this.loadingContent = false;
        this.updateFileIdInStorage(this.fileName, this.fileId);
        this.selectTab('summary');
      },
      error: (err: Error) => {
        this.loadingContent = false;
        this.contentError = err.message || 'Failed to load file content';
      }
    });
  }

  private extractDisplayContent(result: unknown): void {
    if (!result) {
      this.fileContent = '';
      return;
    }
    if (typeof result === 'string') {
      this.fileContent = result;
      return;
    }
    // Handle API response structure: {responseTitle, responseContent: {topic, cleanContent}}
    if (this.isRecord(result) && 'responseContent' in result) {
      const rc = result['responseContent'];
      if (typeof rc === 'string') {
        this.fileContent = rc;
        return;
      }
      if (this.isRecord(rc) && typeof rc['topic'] === 'string') {
        this.fileTopic = rc['topic'];
      }
      if (this.isRecord(rc) && typeof rc['cleanContent'] === 'string') {
        this.fileContent = rc['cleanContent'];
        return;
      }
    }
    this.fileContent = JSON.stringify(result, null, 2);
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

  selectTab(tab: WorkspaceTab): void {
    this.activeTab = tab;

    if (!this.fileId || this.loadingContent || this.contentError) {
      return;
    }

    if (tab === 'summary') {
      this.loadSummary();
      return;
    }

    if (tab === 'flashcards') {
      this.loadFlashcards();
      return;
    }

    this.loadQuiz();
  }

  regenerateActiveTab(): void {
    if (this.activeTab === 'summary') {
      this.loadSummary(true);
      return;
    }

    if (this.activeTab === 'flashcards') {
      this.loadFlashcards(true);
      return;
    }

    this.loadQuiz(true);
  }

  onSendMessage(): void {
    const text = this.chatInput.trim();
    if (!text) return;

    this.chatInput = '';
    this.addMessage('user', text);
    this.addMessage(
      'ai',
      'Use the Summary, Flashcards, and Quiz Mode tabs on the left to generate study content. The assistant panel stays focused on conversation.'
    );
  }

  private loadSummary(force = false): void {
    if (!this.fileId || this.isProcessing) {
      return;
    }

    if (!force && this.summaryState === 'ready') {
      return;
    }

    this.isProcessing = true;
    this.processingAction = 'Generating summary...';
    this.summaryState = 'loading';
    this.summaryError = '';

    this.aiService.generateSummary(this.spaceId, [this.fileId]).subscribe({
      next: (res) => {
        const parsed = this.parseAiTextResponse(res, 'Summary');
        this.summaryTitle = parsed.title;
        this.summaryContent = parsed.content;
        this.summaryState = 'ready';
        this.isProcessing = false;
        this.processingAction = '';
      },
      error: (err: Error) => {
        this.summaryState = 'error';
        this.summaryError = err.message || 'Failed to generate summary';
        this.isProcessing = false;
        this.processingAction = '';
      },
    });
  }

  private loadFlashcards(force = false): void {
    if (!this.fileId || this.isProcessing) {
      return;
    }

    if (!force && this.flashcardsState === 'ready') {
      return;
    }

    this.isProcessing = true;
    this.processingAction = 'Generating flashcards...';
    this.flashcardsState = 'loading';
    this.flashcardsError = '';

    this.aiService.generateFlashcards(this.spaceId, [this.fileId], this.difficulty, this.questionCount).subscribe({
      next: (res) => {
        const parsed = this.parseAiTextResponse(res, 'Flashcards');
        this.flashcardsTitle = parsed.title;
        this.flashcards = this.extractFlashcards(res.responseContent);
        this.flashcardIndex = 0;
        this.flashcardShowsBack = false;
        this.flashcardsRawContent = this.flashcards.length === 0 ? parsed.content : '';
        this.flashcardsState = 'ready';
        this.isProcessing = false;
        this.processingAction = '';
      },
      error: (err: Error) => {
        this.flashcardsState = 'error';
        this.flashcardsError = err.message || 'Failed to generate flashcards';
        this.isProcessing = false;
        this.processingAction = '';
      },
    });
  }

  private loadQuiz(force = false): void {
    if (!this.fileId || this.isProcessing) {
      return;
    }

    if (!force && (this.quizState === 'ready' || this.quizState === 'in-progress' || this.quizState === 'completed')) {
      return;
    }

    this.isProcessing = true;
    this.processingAction = 'Generating quiz...';
    this.quizState = 'loading';
    this.quizError = '';

    if (force) {
      this.resetQuizProgress();
    }

    this.aiService.generateQuiz(this.spaceId, [this.fileId], this.difficulty, this.questionCount).subscribe({
      next: (res) => {
        this.applyQuizResponse(res);
        this.isProcessing = false;
        this.processingAction = '';
      },
      error: (err: Error) => {
        this.quizState = 'error';
        this.quizError = err.message || 'Failed to generate quiz';
        this.isProcessing = false;
        this.processingAction = '';
      },
    });
  }

  private updateFileIdInStorage(fileName: string, fileId: string): void {
    const key = `asc_files_${this.spaceId}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      const files = parsed.filter((item): item is { id: string; name: string } => {
        return this.isRecord(item) && typeof item['id'] === 'string' && typeof item['name'] === 'string';
      });
      const file = files.find((item) => item.name === fileName);
      if (file && file.id !== fileId) {
        file.id = fileId;
        localStorage.setItem(key, JSON.stringify(files));
      }
    } catch {}
  }

  private parseAiTextResponse(res: GeminiResponse, fallbackTitle: string): { title: string; content: string } {
    return {
      title: res.responseTitle || fallbackTitle,
      content: this.extractTextContent(res.responseContent),
    };
  }

  private extractFlashcards(content: unknown): Flashcard[] {
    const structured = this.findArrayByKeys(content, ['flashcards', 'cards', 'items']);
    if (structured.length > 0) {
      return structured
        .map((item) => this.mapFlashcard(item))
        .filter((card): card is Flashcard => !!card);
    }

    if (typeof content !== 'string') {
      return [];
    }

    return content
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter((block) => !!block)
      .map((block) => {
        const frontMatch = block.match(/(?:front|question|term)\s*[:\-]\s*([\s\S]*?)(?:\n|$)/i);
        const backMatch = block.match(/(?:back|answer|definition)\s*[:\-]\s*([\s\S]*)/i);
        if (!frontMatch || !backMatch) {
          return null;
        }

        return {
          front: frontMatch[1].trim(),
          back: backMatch[1].trim(),
        };
      })
      .filter((card): card is Flashcard => !!card && !!card.front && !!card.back);
  }

  private mapFlashcard(item: unknown): Flashcard | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const front = this.readString(item, ['front', 'question', 'prompt', 'term']);
    const back = this.readString(item, ['back', 'answer', 'definition', 'explanation']);

    if (!front || !back) {
      return null;
    }

    return { front, back };
  }

  get currentFlashcard(): Flashcard | null {
    if (this.flashcards.length === 0) {
      return null;
    }

    return this.flashcards[this.flashcardIndex] || null;
  }

  get canGoToPreviousFlashcard(): boolean {
    return this.flashcardIndex > 0;
  }

  get canGoToNextFlashcard(): boolean {
    return this.flashcardIndex < this.flashcards.length - 1;
  }

  toggleFlashcardSide(): void {
    if (!this.currentFlashcard) {
      return;
    }

    this.flashcardShowsBack = !this.flashcardShowsBack;
  }

  goToPreviousFlashcard(): void {
    if (!this.canGoToPreviousFlashcard) {
      return;
    }

    this.flashcardIndex -= 1;
    this.flashcardShowsBack = false;
  }

  goToNextFlashcard(): void {
    if (!this.canGoToNextFlashcard) {
      return;
    }

    this.flashcardIndex += 1;
    this.flashcardShowsBack = false;
  }

  private applyQuizResponse(res: QuizResponse): void {
    this.quizId = res.quizId;
    this.resetQuizProgress();
    this.parseQuizContent(res.operationResponse?.responseContent);
  }

  private parseQuizContent(content: unknown): void {
    const structured = this.extractStructuredArray(content, ['questions', 'quiz']);
    if (structured.length > 0) {
      this.applyQuizQuestions(structured);
      return;
    }

    if (typeof content !== 'string') {
      this.quizState = 'error';
      this.quizError = 'Quiz response was empty. Please try again.';
      return;
    }

    const parsed = this.tryParseJson(content);
    if (Array.isArray(parsed)) {
      this.applyQuizQuestions(parsed);
      return;
    }

    if (this.isRecord(parsed)) {
      const nested = this.extractStructuredArray(parsed, ['questions', 'quiz']);
      if (nested.length > 0) {
        this.applyQuizQuestions(nested);
        return;
      }
    }

    this.parseQuizTextFormat(content);
  }

  private applyQuizQuestions(items: unknown[]): void {
    const questions = items
      .map((item) => this.mapQuizQuestion(item))
      .filter((question): question is QuizQuestion => !!question);

    if (questions.length === 0) {
      this.quizState = 'error';
      this.quizError = 'Quiz questions could not be extracted. Please try again.';
      return;
    }

    this.quizQuestions = questions;
    this.quizState = 'ready';
  }

  private mapQuizQuestion(item: unknown): QuizQuestion | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const question = this.readString(item, ['question', 'text', 'prompt']);
    const rawOptions = item['options'] ?? item['choices'] ?? item['answers'];
    const options = Array.isArray(rawOptions)
      ? rawOptions.map((option) => String(option).trim()).filter((option) => !!option)
      : [];
    const correctAnswer = this.readString(item, ['correctAnswer', 'correct_answer', 'answer']);

    if (!question || options.length === 0) {
      return null;
    }

    return {
      question,
      options,
      correctAnswer,
      userAnswer: null,
      isCorrect: null,
    };
  }

  private parseQuizTextFormat(text: string): void {
    const extractedQuestions: QuizQuestion[] = [];
    const questionBlocks = text.split(/(?=\d+[\.\)]\s)/);

    for (const block of questionBlocks) {
      const questionMatch = block.match(/^\d+[\.\)]\s*(.+?)(?:\n|$)/);
      if (!questionMatch) {
        continue;
      }

      const options: string[] = [];
      const optionMatches = block.matchAll(/[A-D][\.\)]\s*(.+?)(?=\s*[A-D][\.\)]|\s*(?:Correct|Answer)|$)/gis);
      for (const match of optionMatches) {
        options.push(match[1].trim());
      }

      const correctMatch = block.match(/(?:Correct\s*(?:Answer)?|Answer)\s*[:=]\s*([A-D])/i);
      const correctAnswer = correctMatch
        ? options['ABCD'.indexOf(correctMatch[1].toUpperCase())] || ''
        : '';

      if (options.length > 0) {
        extractedQuestions.push({
          question: questionMatch[1].trim(),
          options,
          correctAnswer,
          userAnswer: null,
          isCorrect: null,
        });
      }
    }

    if (extractedQuestions.length === 0) {
      this.quizState = 'error';
      this.quizError = 'Could not parse quiz questions from the AI response. Please try again.';
      return;
    }

    this.quizQuestions = extractedQuestions;
    this.quizState = 'ready';
  }

  private resetQuizProgress(): void {
    this.quizQuestions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.totalAnswered = 0;
  }

  startQuiz(): void {
    if (this.quizQuestions.length === 0) {
      return;
    }

    this.currentIndex = 0;
    this.totalAnswered = 0;
    this.score = 0;
    this.quizQuestions = this.quizQuestions.map((question) => ({
      ...question,
      userAnswer: null,
      isCorrect: null,
    }));
    this.quizState = 'in-progress';
  }

  selectAnswer(option: string): void {
    const question = this.currentQuestion;
    if (!question || question.userAnswer !== null) {
      return;
    }

    question.userAnswer = option;
    question.isCorrect = option === question.correctAnswer;
    this.totalAnswered += 1;
    if (question.isCorrect) {
      this.score += 1;
    }
  }

  nextQuestion(): void {
    if (this.currentIndex < this.quizQuestions.length - 1) {
      this.currentIndex += 1;
      return;
    }

    this.quizState = 'completed';
    this.submitQuizResults();
  }

  retryQuiz(): void {
    this.loadQuiz(true);
  }

  get currentQuestion(): QuizQuestion | null {
    return this.quizQuestions[this.currentIndex] || null;
  }

  get quizProgress(): number {
    if (this.quizQuestions.length === 0) {
      return 0;
    }

    return Math.round((this.totalAnswered / this.quizQuestions.length) * 100);
  }

  get scorePercent(): number {
    if (this.quizQuestions.length === 0) {
      return 0;
    }

    return Math.round((this.score / this.quizQuestions.length) * 100);
  }

  private submitQuizResults(): void {
    if (!this.quizId || !this.fileId) {
      return;
    }

    this.aiService.submitQuiz(this.spaceId, {
      quizId: this.quizId,
      quizFiles: [
        {
          fileId: this.fileId,
          fileQuestionsCount: this.quizQuestions.length,
          correctAnswersCount: this.score,
        },
      ],
    }).subscribe({
      error: () => undefined,
    });
  }

  private extractStructuredArray(content: unknown, keys: string[]): unknown[] {
    if (Array.isArray(content)) {
      return content;
    }

    if (this.isRecord(content)) {
      for (const key of keys) {
        const value = content[key];
        if (Array.isArray(value)) {
          return value;
        }
      }
    }

    if (typeof content !== 'string') {
      return [];
    }

    const parsed = this.tryParseJson(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (this.isRecord(parsed)) {
      for (const key of keys) {
        const value = parsed[key];
        if (Array.isArray(value)) {
          return value;
        }
      }
    }

    return [];
  }

  private findArrayByKeys(content: unknown, keys: string[]): unknown[] {
    const direct = this.extractStructuredArray(content, keys);
    if (direct.length > 0) {
      return direct;
    }

    return this.findArrayByKeysRecursive(content, keys, 0);
  }

  private findArrayByKeysRecursive(content: unknown, keys: string[], depth: number): unknown[] {
    if (depth > 5 || !this.isRecord(content)) {
      return [];
    }

    for (const key of keys) {
      const value = content[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    for (const value of Object.values(content)) {
      const found = this.findArrayByKeysRecursive(value, keys, depth + 1);
      if (found.length > 0) {
        return found;
      }
    }

    return [];
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (!codeBlockMatch) {
        return null;
      }

      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        return null;
      }
    }
  }

  private extractTextContent(content: unknown): string {
    if (typeof content === 'string') {
      return content.trim();
    }

    return JSON.stringify(content, null, 2);
  }

  private readString(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
