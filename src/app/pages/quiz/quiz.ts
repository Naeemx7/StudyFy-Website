import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar';
import { AiService } from '../../services/ai.service';
import { DifficultyLevel } from '../../models/ai.models';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
}

type QuizState = 'loading' | 'ready' | 'in-progress' | 'completed' | 'error';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './quiz.html',
  styleUrl: './quiz.css',
})
export class QuizComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private aiService = inject(AiService);

  spaceId = '';
  fileIds: string[] = [];
  difficulty: DifficultyLevel = 'Medium';
  questionCount = 5;
  quizId = '';

  state: QuizState = 'loading';
  errorMessage = '';
  questions: QuizQuestion[] = [];
  currentIndex = 0;
  score = 0;
  totalAnswered = 0;

  ngOnInit(): void {
    this.spaceId = this.route.snapshot.paramMap.get('spaceId') || '';
    const params = this.route.snapshot.queryParams;
    this.fileIds = (params['fileIds'] || '').split(',').filter((s: string) => s);
    this.difficulty = (params['difficulty'] as DifficultyLevel) || 'Medium';
    this.questionCount = parseInt(params['count'], 10) || 5;

    if (!this.spaceId || this.fileIds.length === 0) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.generateQuiz();
  }

  private generateQuiz(): void {
    this.state = 'loading';
    this.aiService.generateQuiz(this.spaceId, this.fileIds, this.difficulty, this.questionCount).subscribe({
      next: (res) => {
        console.log('Quiz API response:', JSON.stringify(res).substring(0, 500));
        this.quizId = res.quizId;
        const content = res.operationResponse?.responseContent;
        console.log('Quiz responseContent type:', typeof content, content);
        this.parseQuizContent(content);
      },
      error: (err) => {
        console.error('Quiz API error:', err);
        this.state = 'error';
        this.errorMessage = err.message || 'Failed to generate quiz';
      }
    });
  }

  private parseQuizContent(content: unknown): void {
    if (!content) {
      this.state = 'error';
      this.errorMessage = 'Quiz response was empty. Please try again.';
      return;
    }

    try {
      let text: string;
      // Handle content that is already a parsed object (common with AI APIs)
      if (typeof content === 'object' && content !== null) {
        // Check if the object itself has a questions-like structure
        const obj = content as any;
        if (Array.isArray(obj)) {
          this.parseQuestionsArray(obj);
          return;
        }
        if (obj.questions || obj.quiz) {
          this.parseQuestionsArray(obj.questions || obj.quiz);
          return;
        }
        text = JSON.stringify(content);
      } else if (typeof content === 'string') {
        text = content;
      } else {
        text = String(content);
      }

      console.log('Quiz content to parse (first 500 chars):', text.substring(0, 500));

      const originalText = text;
      // Try to parse as JSON array of questions
      let parsed: any;
      // Try direct JSON parse first
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try extracting JSON from markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        }
      }

      if (parsed) {
        // Handle various response formats
        const items = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.quiz || [parsed]);
        this.questions = items.map((q: any) => ({
          question: q.question || q.text || q.prompt || '',
          options: q.options || q.choices || q.answers || [],
          correctAnswer: q.correctAnswer || q.correct_answer || q.answer || '',
          userAnswer: null,
          isCorrect: null,
        })).filter((q: QuizQuestion) => q.question && q.options.length > 0);
      }

      if (this.questions.length === 0) {
        // Fallback: parse text format (numbered questions)
        this.parseTextFormat(text);
      }

      if (this.questions.length > 0) {
        this.state = 'ready';
      } else {
        console.error('Could not parse quiz. Raw content:', originalText.substring(0, 1000));
        this.state = 'error';
        this.errorMessage = 'Could not parse quiz questions from the AI response. Please try again.';
      }
    } catch (e) {
      console.error('Quiz parse error:', e);
      this.state = 'error';
      this.errorMessage = 'Failed to parse quiz data. Please try again.';
    }
  }

  private parseQuestionsArray(items: any[]): void {
    this.questions = items.map((q: any) => ({
      question: q.question || q.text || q.prompt || '',
      options: q.options || q.choices || q.answers || [],
      correctAnswer: q.correctAnswer || q.correct_answer || q.answer || '',
      userAnswer: null,
      isCorrect: null,
    })).filter((q: QuizQuestion) => q.question && q.options.length > 0);

    if (this.questions.length > 0) {
      this.state = 'ready';
    } else {
      this.state = 'error';
      this.errorMessage = 'Quiz questions could not be extracted. Please try again.';
    }
  }

  private parseTextFormat(text: string): void {
    // Parse numbered questions like:
    // 1. What is X?
    // A) option1  B) option2  C) option3  D) option4
    // Correct Answer: B
    const questionBlocks = text.split(/(?=\d+[\.\)]\s)/);
    for (const block of questionBlocks) {
      const qMatch = block.match(/^\d+[\.\)]\s*(.+?)(?:\n|$)/);
      if (!qMatch) continue;

      const question = qMatch[1].trim();
      const options: string[] = [];
      const optionMatches = block.matchAll(/[A-D][\.\)]\s*(.+?)(?=\s*[A-D][\.\)]|\s*(?:Correct|Answer)|$)/gi);
      for (const m of optionMatches) {
        options.push(m[1].trim());
      }

      const correctMatch = block.match(/(?:Correct\s*(?:Answer)?|Answer)\s*[:=]\s*([A-D])/i);
      const correctAnswer = correctMatch ? options['ABCD'.indexOf(correctMatch[1].toUpperCase())] || '' : '';

      if (question && options.length >= 2) {
        this.questions.push({ question, options, correctAnswer, userAnswer: null, isCorrect: null });
      }
    }
  }

  get currentQuestion(): QuizQuestion | null {
    return this.questions[this.currentIndex] || null;
  }

  get progress(): number {
    return this.questions.length > 0 ? Math.round((this.totalAnswered / this.questions.length) * 100) : 0;
  }

  get scorePercent(): number {
    return this.totalAnswered > 0 ? Math.round((this.score / this.totalAnswered) * 100) : 0;
  }

  startQuiz(): void {
    this.state = 'in-progress';
    this.currentIndex = 0;
  }

  selectAnswer(option: string): void {
    const q = this.currentQuestion;
    if (!q || q.userAnswer !== null) return;

    q.userAnswer = option;
    q.isCorrect = option === q.correctAnswer;
    this.totalAnswered++;
    if (q.isCorrect) this.score++;
  }

  nextQuestion(): void {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
    } else {
      this.state = 'completed';
      this.submitResults();
    }
  }

  private submitResults(): void {
    if (!this.quizId) return;
    // Submit quiz results to backend
    this.aiService.submitQuiz(this.spaceId, {
      quizId: this.quizId,
      quizFiles: this.fileIds.map(fid => ({
        fileId: fid,
        fileQuestionsCount: this.questions.length,
        correctAnswersCount: this.score,
      })),
    }).subscribe({ error: () => {} }); // fire and forget
  }

  retryQuiz(): void {
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.totalAnswered = 0;
    this.generateQuiz();
  }

  goBack(): void {
    const fileName = this.route.snapshot.queryParams['fileName'];
    if (fileName) {
      this.router.navigate(['/workspace', this.spaceId, fileName]);
    } else {
      this.router.navigate(['/roadmap', this.spaceId]);
    }
  }
}
