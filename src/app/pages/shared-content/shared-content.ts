import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AiService } from '../../services/ai.service';

interface SharedContent {
  id: string;
  title: string;
  contentType: 'summary' | 'flashcards' | 'quiz-results';
  content: unknown;
  createdAt: string;
  expiresAt?: string;
}

interface Flashcard {
  front: string;
  back: string;
}

interface QuizQuestion {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

@Component({
  selector: 'app-shared-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-content.html',
  styleUrl: './shared-content.css',
})
export class SharedContentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private aiService = inject(AiService);

  // State
  loading = true;
  error = '';
  content: SharedContent | null = null;

  // Summary
  summaryContent = '';
  summaryHtml: SafeHtml = '';

  // Flashcards
  flashcards: Flashcard[] = [];
  currentFlashcardIndex = 0;
  flashcardShowsBack = false;

  // Quiz Results
  quizScore = 0;
  quizTotal = 0;
  quizPercent = 0;
  quizQuestions: QuizQuestion[] = [];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'No shared content ID provided';
      this.loading = false;
      return;
    }

    this.loadSharedContent(id);
  }

  private loadSharedContent(id: string): void {
    console.log('📂 Loading shared content:', id);

    this.aiService.getSharedContent(id).subscribe({
      next: (content) => {
        console.log('✅ Shared content loaded:', content);
        this.content = content;
        this.processContent(content);
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Failed to load shared content:', err);
        this.error = err.message || 'Failed to load shared content. It may have expired.';
        this.loading = false;
      },
    });
  }

  private processContent(content: SharedContent): void {
    if (content.contentType === 'summary') {
      this.processSummary(content.content);
    } else if (content.contentType === 'flashcards') {
      this.processFlashcards(content.content);
    } else if (content.contentType === 'quiz-results') {
      this.processQuizResults(content.content);
    }
  }

  private processSummary(data: unknown): void {
    if (typeof data === 'string') {
      this.summaryContent = data;
    } else if (this.isRecord(data) && typeof data['content'] === 'string') {
      this.summaryContent = data['content'];
    } else {
      this.summaryContent = JSON.stringify(data, null, 2);
    }

    this.summaryHtml = this.sanitizer.bypassSecurityTrustHtml(
      this.markdownToHtml(this.summaryContent)
    );
  }

  private processFlashcards(data: unknown): void {
    let cards: Flashcard[] = [];

    if (Array.isArray(data)) {
      cards = data
        .map((item) => this.extractFlashcard(item))
        .filter((card): card is Flashcard => !!card);
    } else if (this.isRecord(data)) {
      if (Array.isArray(data['cards'])) {
        cards = data['cards']
          .map((item) => this.extractFlashcard(item))
          .filter((card): card is Flashcard => !!card);
      } else if (Array.isArray(data['flashcards'])) {
        cards = data['flashcards']
          .map((item) => this.extractFlashcard(item))
          .filter((card): card is Flashcard => !!card);
      }
    }

    this.flashcards = cards;
    this.currentFlashcardIndex = 0;
    this.flashcardShowsBack = false;
  }

  private extractFlashcard(item: unknown): Flashcard | null {
    if (!this.isRecord(item)) return null;

    const front = item['front'] || item['question'] || item['term'];
    const back = item['back'] || item['answer'] || item['definition'];

    if (typeof front === 'string' && typeof back === 'string') {
      return { front, back };
    }
    return null;
  }

  private processQuizResults(data: unknown): void {
    if (!this.isRecord(data)) return;

    this.quizScore = typeof data['score'] === 'number' ? data['score'] : 0;
    this.quizTotal = typeof data['total'] === 'number' ? data['total'] : 0;
    this.quizPercent = typeof data['percent'] === 'number' ? data['percent'] : 0;

    if (Array.isArray(data['questions'])) {
      this.quizQuestions = data['questions']
        .map((q) => this.extractQuizQuestion(q))
        .filter((q): q is QuizQuestion => !!q);
    }
  }

  private extractQuizQuestion(item: unknown): QuizQuestion | null {
    if (!this.isRecord(item)) return null;

    const question = item['question'];
    const userAnswer = item['userAnswer'];
    const correctAnswer = item['correctAnswer'];
    const isCorrect = item['isCorrect'];

    if (
      typeof question === 'string' &&
      typeof userAnswer === 'string' &&
      typeof correctAnswer === 'string' &&
      typeof isCorrect === 'boolean'
    ) {
      return {
        question,
        userAnswer,
        correctAnswer,
        isCorrect,
      };
    }
    return null;
  }

  toggleFlashcard(): void {
    this.flashcardShowsBack = !this.flashcardShowsBack;
  }

  nextFlashcard(): void {
    if (this.currentFlashcardIndex < this.flashcards.length - 1) {
      this.currentFlashcardIndex++;
      this.flashcardShowsBack = false;
    }
  }

  prevFlashcard(): void {
    if (this.currentFlashcardIndex > 0) {
      this.currentFlashcardIndex--;
      this.flashcardShowsBack = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  private markdownToHtml(markdown: string): string {
    let html = markdown
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/gm, '<p>')
      .replace(/$/gm, '</p>');

    return `<div class="prose prose-sm max-w-none">${html}</div>`;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
