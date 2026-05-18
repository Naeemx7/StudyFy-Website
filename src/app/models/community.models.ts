/**
 * Community Models
 */

// Request DTOs
export interface CreateCommunityRequest {
  name: string;
  description?: string;
  userIds?: string[];
}

// Response DTOs
export interface Community {
  id: string;
  name: string;
  description?: string;
  joinCode?: string;
  createdAt?: string;
}

export interface LeaderboardEntry {
  userName: string;
  xp: number;
  rank: number;
}

export interface Leaderboard {
  leaderboard: LeaderboardEntry[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  isSuccess: boolean;
  message?: string;
  errors?: string[];
  data: T;
}
