/**
 * Analytics Models
 *
 * TypeScript interfaces for the Global Analytics API response.
 *
 * ENDPOINT: GET /users/{userId}/analytics/global
 *
 * WHAT IT RETURNS:
 * - User streak (days studied in a row)
 * - Per-space stats: total files, total quizzes, average score
 * - Per-file detail: tags and weak tags
 * - Individual quiz records with date/score/difficulty
 */

/**
 * A single file within a space, with its AI-generated tags and weak topic tags.
 * Nullable fields appear when no quiz has been taken for a file yet.
 */
export interface AnalyticsFileDetail {
  fileId: string | null;
  fileName: string | null;
  workspaceId: string | null;
  uploadedAt: string | null;
  weakTags: string[] | null;
  tags: string[] | null;
}

/**
 * Aggregate stats for one Space, including its files.
 * averageScore is in 0–100 range (e.g. 72.5 = 72.5%).
 */
export interface AnalyticsSpaceDetail {
  spaceId: string;
  name: string;
  description: string;
  createdAt: string;
  totalFiles: number;
  totalQuizzes: number;
  averageScore: number;
  files: AnalyticsFileDetail[];
}

/**
 * A single quiz attempt record used for trend charts and averages.
 * score is in 0–100 range.
 */
export interface AnalyticsQuizEntry {
  quizId: string;
  quizDate: string;
  score: number;
  difficultyLevel: string;
}

/**
 * Full response data from GET /users/{userId}/analytics/global
 */
export interface GlobalAnalytics {
  userId: string;
  userName: string;
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  userBadges: string[];
  spaceDetails: AnalyticsSpaceDetail[];
  quizData: AnalyticsQuizEntry[];
}

/**
 * Wrapper matching the standard API envelope used throughout the backend.
 */
export interface AnalyticsApiResponse {
  isSuccess: boolean;
  message: string;
  errors?: string[];
  data: GlobalAnalytics;
}
