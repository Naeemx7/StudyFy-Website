/**
 * AI Models (DTOs)
 *
 * These match the WorkspaceAI endpoints from the backend API:
 * - POST /summary       - Generate AI summary from files
 * - POST /flashcards    - Generate flashcards from files
 * - POST /quiz          - Generate quiz from files
 * - POST /quiz-submission - Submit quiz answers
 * - POST /tags-quiz     - Generate quiz from specific topic tags
 */

// ============================================
// REQUEST DTOs
// ============================================

/** Request body for POST /summary */
export interface SummaryRequest {
  filesId: string[];
}

/** Request body for POST /flashcards */
export interface FlashcardsRequest {
  filesId: string[];
  difficultyLevel: DifficultyLevel;
  numberOfQuestions: number;
}

/** Request body for POST /quiz */
export interface QuizRequest {
  filesId: string[];
  difficultyLevel: DifficultyLevel;
  numberOfQuestions: number;
}

/** Request body for POST /quiz-submission */
export interface QuizSubmissionRequest {
  quizId: string;
  quizTags: QuizTagSubmission[];
}

export interface QuizTagSubmission {
  tagName: string;
  tagQuestionsCount: number;
  correctAnswersCount: number;
}

/** Request body for POST /tags-quiz */
export interface TagsQuizRequest {
  tags: string[];
  difficultyLevel: DifficultyLevel;
  numberOfQuestions: number;
}

/** Difficulty levels for quiz/flashcard generation */
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

// ============================================
// RESPONSE DTOs
// ============================================

/** Generic API response wrapper */
export interface ApiResponse<T> {
  isSuccess: boolean;
  message: string;
  errors?: string[];
  data: T;
}

/** Response from POST /summary and POST /flashcards (GeminiResponseDto) */
export interface GeminiResponse {
  responseTitle: string;
  responseContent: unknown;
}

/** Response from POST /quiz */
export interface QuizResponse {
  quizId: string;
  workSpaceId: string;
  userId: string;
  operationResponse: GeminiResponse;
}

/** Response from POST /quiz-submission */
export interface QuizSubmissionResponse {
  isSuccess: boolean;
  message: string;
}
