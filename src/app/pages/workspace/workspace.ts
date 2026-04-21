import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { StorageService } from '../../services/storage.service';
import { AiService } from '../../services/ai.service';
import { ChatService } from '../../services/chat.service';
import { DifficultyLevel, GeminiResponse, QuizResponse, QuizTagSubmission } from '../../models/ai.models';
import { ChatMessage, ChatSessionListItem } from '../../models/chat.models';

type WorkspaceTab = 'summary' | 'flashcards' | 'quiz';
type ContentState = 'idle' | 'loading' | 'ready' | 'error';
type QuizState = 'idle' | 'loading' | 'ready' | 'in-progress' | 'completed' | 'review' | 'error';

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
  tagName?: string;
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
  private sanitizer = inject(DomSanitizer);
  private storageService = inject(StorageService);
  private aiService = inject(AiService);
  private chatService = inject(ChatService);

  // Route params
  spaceId = '';
  fileName = '';

  // File state
  fileContent = '';
  fileTopic = '';
  fileId = '';
  fileTags: string[] = [];
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

  // Tags quiz state
  tagsQuizLoading = false;
  tagsQuizError = '';

  // Chat state
  messages: ChatMessage[] = [];
  chatSessions: ChatSessionListItem[] = [];
  currentSessionId = '';
  chatLoading = false;
  chatError = '';
  showSessionsList = false;
  isProcessing = false;
  processingAction = '';

  // Quiz practice mode (tags-quiz) — skip submission to avoid backend tag-not-found errors
  isTagsQuiz = false;

  // Settings
  difficulty: DifficultyLevel = 'Medium';
  questionCount = 5;
  chatInput = '';
  private shouldScroll = false;

  ngOnInit(): void {
    this.spaceId = this.route.snapshot.paramMap.get('spaceId') || '';
    this.fileName = this.route.snapshot.queryParamMap.get('file') || '';

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
        this.fileTags = content.tags ?? [];
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
    if (!text || this.chatLoading) return;

    this.chatInput = '';
    this.chatError = '';

    // If no session yet, create one first
    if (!this.currentSessionId) {
      if (!this.fileId || !this.spaceId) return;
      this.chatLoading = true;
      this.chatService.createSession(this.spaceId, [this.fileId], this.fileName).subscribe({
        next: (session) => {
          this.currentSessionId = session.id;
          this.messages = session.messages || [];
          console.log('Chat session created:', session.id);
          // Now send the actual message
          this.sendChatMessage(text);
        },
        error: (err) => {
          this.chatLoading = false;
          this.chatError = err.message || 'Failed to create chat session';
          console.error('Create session error:', err);
        },
      });
      return;
    }

    this.sendChatMessage(text);
  }

  private sendChatMessage(text: string): void {
    this.chatLoading = true;
    this.chatService.sendMessage(this.spaceId, this.currentSessionId, text).subscribe({
      next: (res) => {
        if (!res) {
          this.chatLoading = false;
          this.chatError = 'AI could not generate a response. The model may be at capacity — try again later.';
          console.warn('sendMessage returned null data — AI backend may be overloaded');
          return;
        }
        this.messages.push(res.userMessage);
        this.messages.push(res.assistantMessage);
        this.chatLoading = false;
        this.shouldScroll = true;
        console.log('Chat response:', res);
      },
      error: (err) => {
        this.chatLoading = false;
        this.chatError = err.message || 'Failed to send message';
        console.error('Send message error:', err);
      },
    });
  }

  loadChatSessions(): void {
    if (!this.spaceId) return;
    this.chatService.listSessions(this.spaceId).subscribe({
      next: (sessions) => {
        this.chatSessions = sessions;
        this.showSessionsList = true;
        console.log('Chat sessions:', sessions);
      },
      error: (err) => {
        console.error('List sessions error:', err);
      },
    });
  }

  openSession(sessionId: string): void {
    if (!this.spaceId) return;
    this.chatLoading = true;
    this.showSessionsList = false;
    this.chatService.getSession(this.spaceId, sessionId).subscribe({
      next: (session) => {
        this.currentSessionId = session.id;
        this.messages = session.messages || [];
        this.chatLoading = false;
        this.shouldScroll = true;
        console.log('Opened session:', session.id, 'messages:', session.messages.length);
      },
      error: (err) => {
        this.chatLoading = false;
        this.chatError = err.message || 'Failed to load session';
      },
    });
  }

  deleteSession(sessionId: string): void {
    if (!this.spaceId) return;
    this.chatService.deleteSession(this.spaceId, sessionId).subscribe({
      next: () => {
        this.chatSessions = this.chatSessions.filter(s => s.id !== sessionId);
        if (this.currentSessionId === sessionId) {
          this.currentSessionId = '';
          this.messages = [];
        }
        console.log('Deleted session:', sessionId);
      },
      error: (err) => {
        console.error('Delete session error:', err);
      },
    });
  }

  startNewChat(): void {
    this.currentSessionId = '';
    this.messages = [];
    this.chatError = '';
    this.showSessionsList = false;
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
        if (!this.fileTopic && this.isRecord(res.responseContent)) {
          const topic = (res.responseContent as Record<string, unknown>)['topic'];
          if (typeof topic === 'string') this.fileTopic = topic;
        }
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
    console.log('Quiz API response payload:', res);

    const content = res.operationResponse?.responseContent;

    // Try the known structured format first: extracts ALL questions across all tags
    const taggedQuestions = this.extractTaggedQuestionsFromContent(content ?? res.operationResponse ?? res);
    if (taggedQuestions.length > 0) {
      this.quizQuestions = taggedQuestions;
      this.quizState = 'ready';
      return;
    }

    // Fallback to generic parser
    if (content !== undefined && content !== null) {
      this.parseQuizContent(content);
      return;
    }

    if (res.operationResponse) {
      this.parseQuizContent(res.operationResponse);
      return;
    }

    this.parseQuizContent(res);
  }

  private parseQuizContent(content: unknown): void {
    const embeddedError = this.extractEmbeddedErrorMessage(content);
    if (embeddedError) {
      this.quizState = 'error';
      this.quizError = embeddedError;
      return;
    }

    const structured = this.findArrayByKeys(content, ['questions', 'quiz', 'items']);
    if (structured.length > 0) {
      this.applyQuizQuestions(structured);
      return;
    }

    const deepQuestionCandidates = this.findQuizQuestionCandidates(content, 0);
    if (deepQuestionCandidates.length > 0) {
      this.applyQuizQuestions(deepQuestionCandidates);
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
      const nested = this.findArrayByKeys(parsed, ['questions', 'quiz', 'items']);
      if (nested.length > 0) {
        this.applyQuizQuestions(nested);
        return;
      }
    }

    this.parseQuizTextFormat(content);
  }

  private extractEmbeddedErrorMessage(content: unknown): string {
    if (typeof content === 'string') {
      const parsed = this.tryParseJson(content);
      if (parsed) {
        return this.extractEmbeddedErrorMessage(parsed);
      }
      return '';
    }

    if (!this.isRecord(content)) {
      return '';
    }

    const directMessage = this.readStringCaseInsensitive(content, ['message', 'errorMessage', 'detail', 'description']);
    const code = this.readStringCaseInsensitive(content, ['code', 'statusCode']);
    if (directMessage && (code === '429' || directMessage.toLowerCase().includes('quota') || directMessage.toLowerCase().includes('rate'))) {
      return directMessage;
    }

    const errorNode = this.readPropertyCaseInsensitive(content, ['error']);
    if (errorNode) {
      const nestedMessage = this.extractEmbeddedErrorMessage(errorNode);
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    for (const value of Object.values(content)) {
      const nestedMessage = this.extractEmbeddedErrorMessage(value);
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    return '';
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

  private findQuizQuestionCandidates(content: unknown, depth: number): unknown[] {
    if (depth > 6) {
      return [];
    }

    if (typeof content === 'string') {
      const parsed = this.tryParseJson(content);
      if (parsed) {
        return this.findQuizQuestionCandidates(parsed, depth + 1);
      }

      return [];
    }

    if (Array.isArray(content)) {
      const direct = content.filter((item) => this.looksLikeQuizQuestionRecord(item));
      if (direct.length > 0) {
        return direct;
      }

      for (const item of content) {
        const nested = this.findQuizQuestionCandidates(item, depth + 1);
        if (nested.length > 0) {
          return nested;
        }
      }

      return [];
    }

    if (!this.isRecord(content)) {
      return [];
    }

    const values = Object.values(content);
    const directValues = values.filter((item) => this.looksLikeQuizQuestionRecord(item));
    if (directValues.length > 0) {
      return directValues;
    }

    const keyBasedCandidates = this.readPropertyCaseInsensitive(content, ['questions', 'quiz', 'items']);
    if (Array.isArray(keyBasedCandidates)) {
      return keyBasedCandidates;
    }

    if (this.isRecord(keyBasedCandidates)) {
      const mapped = Object.values(keyBasedCandidates).filter((item) => this.looksLikeQuizQuestionRecord(item));
      if (mapped.length > 0) {
        return mapped;
      }
    }

    for (const value of values) {
      const nested = this.findQuizQuestionCandidates(value, depth + 1);
      if (nested.length > 0) {
        return nested;
      }
    }

    return [];
  }

  private looksLikeQuizQuestionRecord(item: unknown): boolean {
    if (!this.isRecord(item)) {
      return false;
    }

    const question = this.extractQuestionText(item);
    if (!question) {
      return false;
    }

    const options = this.extractOptionsFromQuestionRecord(item);

    return options.length > 0;
  }

  private mapQuizQuestion(item: unknown): QuizQuestion | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const question = this.extractQuestionText(item);
    const options = this.extractOptionsFromQuestionRecord(item);
    const rawCorrectAnswer = this.readStringCaseInsensitive(item, [
      'correctAnswer',
      'correct_answer',
      'correctOption',
      'correct',
      'answer',
      'answerKey',
      'rightAnswer',
      'correctChoice',
      'right_option',
      'correct_option',
    ]);
    const rawOptions = this.readPropertyCaseInsensitive(item, [
      'options',
      'choices',
      'answers',
      'alternatives',
      'selections',
      'optionsList',
      'choicesList',
    ]);

    let correctAnswer = this.resolveCorrectAnswer(rawCorrectAnswer, options);
    if (!correctAnswer) {
      correctAnswer = this.extractCorrectAnswerFromOptionNodes(rawOptions, options);
    }

    if (!correctAnswer) {
      const correctIndex = this.readNumberCaseInsensitive(item, [
        'correctAnswer',
        'correct_answer',
        'answer',
        'answerKey',
        'correctIndex',
        'correctOptionIndex',
        'answerIndex',
        'rightAnswerIndex',
        'correct_choice_index',
      ]);

      if (correctIndex !== null) {
        const zeroBased = correctIndex > 0 ? correctIndex - 1 : correctIndex;
        if (zeroBased >= 0 && zeroBased < options.length) {
          correctAnswer = options[zeroBased];
        }
      }
    }

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

  private extractCorrectAnswerFromOptionNodes(rawOptions: unknown, options: string[]): string {
    if (!Array.isArray(rawOptions)) {
      return '';
    }

    for (const optionNode of rawOptions) {
      if (!this.isRecord(optionNode)) {
        continue;
      }

      const isCorrect = this.readBooleanCaseInsensitive(optionNode, [
        'isCorrect',
        'correct',
        'isAnswer',
        'right',
      ]);

      if (!isCorrect) {
        continue;
      }

      const optionText = this.readStringCaseInsensitive(optionNode, [
        'text',
        'option',
        'value',
        'label',
        'answer',
      ]);

      if (optionText) {
        return this.resolveCorrectAnswer(optionText, options);
      }
    }

    return '';
  }

  private readBooleanCaseInsensitive(source: Record<string, unknown>, keys: string[]): boolean {
    for (const key of keys) {
      const value = this.readPropertyCaseInsensitive(source, [key]);
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
          return true;
        }
      }

      if (typeof value === 'number' && value === 1) {
        return true;
      }
    }

    return false;
  }

  private readNumberCaseInsensitive(source: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = this.readPropertyCaseInsensitive(source, [key]);
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return null;
  }

  private extractQuestionText(source: Record<string, unknown>): string {
    const direct = this.readStringCaseInsensitive(source, [
      'question',
      'questionText',
      'text',
      'prompt',
      'stem',
      'title',
      'query',
    ]);
    if (direct) {
      return direct;
    }

    const questionNode = this.readPropertyCaseInsensitive(source, ['question']);
    if (this.isRecord(questionNode)) {
      const nested = this.readStringCaseInsensitive(questionNode, ['text', 'value', 'label', 'content']);
      if (nested) {
        return nested;
      }
    }

    const dynamicKey = Object.keys(source).find((key) => key.toLowerCase().includes('question'));
    if (dynamicKey) {
      const value = source[dynamicKey];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (this.isRecord(value)) {
        const nested = this.readStringCaseInsensitive(value, ['text', 'value', 'label', 'content']);
        if (nested) {
          return nested;
        }
      }
    }

    return '';
  }

  private extractOptionsFromQuestionRecord(source: Record<string, unknown>): string[] {
    const rawOptions = this.readPropertyCaseInsensitive(source, [
      'options',
      'choices',
      'answers',
      'alternatives',
      'selections',
      'optionsList',
      'choicesList',
    ]);
    let options = this.extractQuizOptions(rawOptions);

    if (options.length === 0) {
      options = this.readOptionFields(source);
    }

    if (options.length === 0) {
      const directLetterOptions = ['A', 'B', 'C', 'D']
        .map((key) => this.readStringCaseInsensitive(source, [key]))
        .filter((value) => !!value);
      options = directLetterOptions;
    }

    if (options.length === 0) {
      const combined = this.readStringCaseInsensitive(source, ['optionsText', 'choicesText', 'answersText']);
      if (combined) {
        options = this.extractQuizOptions(combined);
      }
    }

    if (options.length === 0) {
      const questionText = this.extractQuestionText(source);
      options = Object.entries(source)
        .filter(([key, value]) => {
          if (typeof value !== 'string') {
            return false;
          }

          const normalized = key.toLowerCase();
          if (normalized.includes('question') || normalized.includes('correct')) {
            return false;
          }

          return value.trim() && value.trim() !== questionText;
        })
        .map(([, value]) => (value as string).trim())
        .slice(0, 6);
    }

    return Array.from(new Set(options.filter((option) => !!option)));
  }

  private readPropertyCaseInsensitive(source: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (key in source) {
        return source[key];
      }

      const match = Object.keys(source).find((itemKey) => itemKey.toLowerCase() === key.toLowerCase());
      if (match) {
        return source[match];
      }
    }

    return undefined;
  }

  private readStringCaseInsensitive(source: Record<string, unknown>, keys: string[]): string {
    const direct = this.readString(source, keys);
    if (direct) {
      return direct;
    }

    for (const key of keys) {
      const match = Object.keys(source).find((itemKey) => itemKey.toLowerCase() === key.toLowerCase());
      if (!match) {
        continue;
      }

      const value = source[match];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  private readOptionFields(source: Record<string, unknown>): string[] {
    const keys = [
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'choiceA',
      'choiceB',
      'choiceC',
      'choiceD',
      'option1',
      'option2',
      'option3',
      'option4',
      'choice1',
      'choice2',
      'choice3',
      'choice4',
    ];
    const options = keys
      .map((key) => this.readStringCaseInsensitive(source, [key]))
      .filter((value) => !!value);

    return options;
  }

  private extractQuizOptions(rawOptions: unknown): string[] {
    if (Array.isArray(rawOptions)) {
      return rawOptions
        .map((option) => {
          if (typeof option === 'string') {
            return option.trim();
          }

          if (this.isRecord(option)) {
            const letterValue = this.readLetteredOptionObject(option);
            if (letterValue) {
              return letterValue;
            }

            return this.readString(option, ['text', 'option', 'value', 'label']);
          }

          return String(option).trim();
        })
        .filter((option) => !!option);
    }

    if (this.isRecord(rawOptions)) {
      const letterKeys = ['A', 'B', 'C', 'D'];
      const hasLetterKeys = letterKeys.every((key) => key in rawOptions);
      if (hasLetterKeys) {
        return letterKeys
          .map((key) => {
            const value = rawOptions[key];
            return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
          })
          .filter((option) => !!option);
      }

      return Object.values(rawOptions)
        .map((value) => {
          if (typeof value === 'string') {
            return value.trim();
          }

          if (this.isRecord(value)) {
            const letterValue = this.readLetteredOptionObject(value);
            if (letterValue) {
              return letterValue;
            }

            return this.readString(value, ['text', 'option', 'value', 'label']);
          }

          return String(value ?? '').trim();
        })
        .filter((option) => !!option);
    }

    if (typeof rawOptions === 'string') {
      return rawOptions
        .split(/\n|\|/)
        .map((part) => part.replace(/^[A-D][\).:\-]\s*/i, '').trim())
        .filter((option) => !!option);
    }

    return [];
  }

  private readLetteredOptionObject(source: Record<string, unknown>): string {
    for (const key of ['A', 'B', 'C', 'D']) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    const firstKey = Object.keys(source)[0];
    if (!firstKey) {
      return '';
    }

    if (/^[A-D]$/i.test(firstKey)) {
      const value = source[firstKey];
      return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    }

    return '';
  }

  private resolveCorrectAnswer(rawCorrectAnswer: string, options: string[]): string {
    if (!rawCorrectAnswer) {
      return '';
    }

    const trimmed = rawCorrectAnswer.trim();
    const matched = this.findMatchingOption(options, trimmed);
    if (matched) {
      return matched;
    }

    const letterMatch = trimmed.match(/^[A-D]$/i);
    if (letterMatch) {
      const index = 'ABCD'.indexOf(letterMatch[0].toUpperCase());
      return index >= 0 ? options[index] || '' : '';
    }

    const prefixedLetterMatch = trimmed.match(/^([A-D])[\).:\-]/i);
    if (prefixedLetterMatch) {
      const index = 'ABCD'.indexOf(prefixedLetterMatch[1].toUpperCase());
      return index >= 0 ? options[index] || '' : '';
    }

    const optionLetterMatch = trimmed.match(/(?:option|choice|answer)\s*([A-D])/i);
    if (optionLetterMatch) {
      const index = 'ABCD'.indexOf(optionLetterMatch[1].toUpperCase());
      return index >= 0 ? options[index] || '' : '';
    }

    const numericIndexMatch = trimmed.match(/^\d+$/);
    if (numericIndexMatch) {
      const parsed = Number(trimmed);
      const zeroBased = parsed > 0 ? parsed - 1 : parsed;
      return zeroBased >= 0 && zeroBased < options.length ? options[zeroBased] : '';
    }

    return trimmed;
  }

  private findMatchingOption(options: string[], candidate: string): string {
    const normalizedCandidate = this.normalizeQuizText(candidate);

    const exact = options.find((option) => this.normalizeQuizText(option) === normalizedCandidate);
    if (exact) {
      return exact;
    }

    // Only attempt partial match for longer candidates (8+ chars).
    // Short candidates like "A", "1", "yes" must not partial-match here because
    // they can be contained in every option string, causing all options to appear correct.
    // Short answers are handled by the letter/index detection in resolveCorrectAnswer instead.
    if (normalizedCandidate.length >= 8) {
      const partial = options.find((option) =>
        this.normalizeQuizText(option).includes(normalizedCandidate)
      );
      if (partial) {
        return partial;
      }
    }

    return '';
  }

  private extractTagNamesFromQuizContent(content: unknown): string[] {
    if (!content) return [];
    const parsed = typeof content === 'string' ? this.tryParseJson(content) : content;
    if (!this.isRecord(parsed)) return [];
    // Structure: { "filename.pdf": { "tags": { "TagName1": {...}, ... } } }
    for (const fileData of Object.values(parsed)) {
      if (this.isRecord(fileData) && this.isRecord(fileData['tags'])) {
        const tags = Object.keys(fileData['tags'] as Record<string, unknown>);
        if (tags.length > 0) return tags;
      }
    }
    // Flat tags object at top level
    if (this.isRecord(parsed['tags'])) {
      return Object.keys(parsed['tags'] as Record<string, unknown>);
    }
    return [];
  }

  /** Collect ALL questions across every tag in the API response, tagging each with its tagName. */
  private extractTaggedQuestionsFromContent(content: unknown): QuizQuestion[] {
    const parsed = typeof content === 'string' ? this.tryParseJson(content) : content;
    if (!this.isRecord(parsed)) return [];

    const all: QuizQuestion[] = [];

    for (const fileData of Object.values(parsed)) {
      if (!this.isRecord(fileData)) continue;
      const tags = fileData['tags'];
      if (!this.isRecord(tags)) continue;

      for (const [tagName, tagData] of Object.entries(tags as Record<string, unknown>)) {
        if (!this.isRecord(tagData)) continue;
        const questions = tagData['questions'];
        if (!Array.isArray(questions) || questions.length === 0) continue;

        for (const q of questions) {
          const mapped = this.mapQuizQuestion(q);
          if (mapped) {
            mapped.tagName = tagName;
            all.push(mapped);
          }
        }
      }
    }

    return all;
  }

  private normalizeQuizText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[“”"'`]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
    this.isTagsQuiz = false;
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
    question.isCorrect = this.isCorrectOption(question, option);
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

  /** Get tags that the user got wrong on the current quiz */
  getWeakTagsFromQuiz(): string[] {
    const weakSet = new Set<string>();
    for (const q of this.quizQuestions) {
      if (!q.isCorrect && q.tagName) {
        weakSet.add(q.tagName);
      }
    }
    return Array.from(weakSet);
  }

  /** Call POST /tags-quiz with the tags the user got wrong, then start a real quiz */
  practiceWeakTags(): void {
    const weakTags = this.getWeakTagsFromQuiz();
    if (weakTags.length === 0 || !this.spaceId) return;

    this.tagsQuizLoading = true;
    this.tagsQuizError = '';

    this.aiService.generateTagsQuiz(this.spaceId, weakTags, this.difficulty, this.questionCount).subscribe({
      next: (res) => {
        this.tagsQuizLoading = false;
        console.log('Tags quiz response:', res);
        if (!res) {
          this.tagsQuizError = 'The AI could not generate a practice quiz for these topics right now. Please try again later.';
          return;
        }
        // applyQuizResponse calls resetQuizProgress which clears isTagsQuiz,
        // so we must set the flag AFTER the call, not before.
        this.applyQuizResponse(res);
        this.isTagsQuiz = true;
        this.quizState = 'ready';
      },
      error: (err) => {
        this.tagsQuizError = err.message || 'Failed to load weak topics quiz';
        this.tagsQuizLoading = false;
        console.error('Tags quiz error:', err);
      },
    });
  }

  reviewQuestion(index: number): void {
    if (this.quizQuestions.length === 0) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, this.quizQuestions.length - 1));
    this.currentIndex = safeIndex;
    this.quizState = 'review';
  }

  backToResults(): void {
    if (this.quizQuestions.length === 0) {
      return;
    }

    this.quizState = 'completed';
  }

  previousReviewQuestion(): void {
    if (this.currentIndex <= 0) {
      return;
    }

    this.currentIndex -= 1;
  }

  nextReviewQuestion(): void {
    if (this.currentIndex >= this.quizQuestions.length - 1) {
      return;
    }

    this.currentIndex += 1;
  }

  isCorrectOption(question: QuizQuestion, option: string): boolean {
    if (!question.correctAnswer) {
      return false;
    }

    // correctAnswer is already the full option text (resolved by resolveCorrectAnswer).
    // Use exact comparison — normalizeQuizText strips [], (), {} etc. which makes
    // C++ syntax options that only differ by brackets all normalize to the same string.
    return option.trim() === question.correctAnswer.trim() ||
      option.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
  }

  getDisplayCorrectAnswer(question: QuizQuestion): string {
    if (!question.correctAnswer) {
      return 'Correct answer was not provided by backend';
    }

    const optionMatch = question.options.find((option) => this.isCorrectOption(question, option));
    return optionMatch || question.correctAnswer;
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
    // Tags-quiz (practice mode) — backend rejects submission for dynamically-tagged quizzes
    if (this.isTagsQuiz || !this.quizId || !this.fileId) {
      return;
    }

    // Build per-tag stats from the tagName stored on each question
    const tagMap = new Map<string, { total: number; correct: number }>();
    for (const q of this.quizQuestions) {
      const key = q.tagName ?? (this.fileTags[0] ?? 'General');
      const entry = tagMap.get(key) ?? { total: 0, correct: 0 };
      entry.total++;
      if (q.isCorrect) entry.correct++;
      tagMap.set(key, entry);
    }

    const quizTags: QuizTagSubmission[] = Array.from(tagMap.entries()).map(([tagName, stats]) => ({
      tagName,
      tagQuestionsCount: stats.total,
      correctAnswersCount: stats.correct,
    }));

    console.log('Submitting quiz payload:', { quizId: this.quizId, quizTags });

    this.aiService.submitQuiz(this.spaceId, {
      quizId: this.quizId,
      quizTags,
    }).subscribe({
      next: (result) => console.log('Quiz submission result:', result),
      error: (err) => console.error('Quiz submission error:', err),
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
    if (typeof content === 'string') {
      const parsed = this.tryParseJson(content);
      if (parsed) {
        return this.findArrayByKeysRecursive(parsed, keys, depth + 1);
      }

      return [];
    }

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

    if (this.isRecord(content)) {
      const text = this.readString(content, ['Summary', 'summary', 'content', 'text', 'description', 'body', 'overview']);
      if (text) return text;
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

  // ===== Navigation =====

  goBack(): void {
    this.router.navigate(['/roadmap', this.spaceId]);
  }

  /** Convert basic markdown (bold, bullets, inline code) to safe HTML for chat messages */
  renderMarkdown(text: string): SafeHtml {
    let html = text
      // Escape HTML entities first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold: **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Inline code: `text`
      .replace(/`([^`]+)`/g, '<code class="bg-gray-200 text-gray-800 rounded px-1 text-xs font-mono">$1</code>')
      // Bullet points: lines starting with * or -
      .replace(/^[\*\-]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/(<li[\s\S]*?<\/li>)(\s*<li)/g, '$1$2')
      // Line breaks
      .replace(/\n/g, '<br>');

    // Wrap sequences of li elements in a ul
    html = html.replace(/(<li[^>]*>[\s\S]*?<\/li>(<br>)*)+/g, (match) => {
      const cleaned = match.replace(/<br>/g, '');
      return `<ul class="my-1 space-y-0.5">${cleaned}</ul>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
