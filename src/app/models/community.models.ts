/**
 * Community Models
 *
 * Matches the Community endpoints from the backend API:
 * - POST   /users/{userId}/communities                              — Create community
 * - GET    /users/{userId}/communities                              — List user's communities
 * - GET    /communities/{communityId}                               — Get community detail
 * - DELETE /users/{userId}/communities/{communityId}                — Delete community
 * - POST   /users/{userId}/communities/{joinCode}/join              — Join community
 * - DELETE /users/{userId}/communities/{communityId}/leave          — Leave community
 * - GET    /communities/{communityId}/leaderBoard                   — Get leaderboard
 * - POST   /communities/{communityId}/photo                         — Upload community photo
 * - DELETE /communities/{communityId}/photo                         — Delete community photo
 * - GET    /communities/{communityId}/photo                         — Get community photo
 * - POST   /communities/{communityId}/posts                         — Create post
 * - GET    /communities/{communityId}/posts                         — List posts
 * - GET    /communities/{communityId}/posts/{postId}                — Get post detail
 * - GET    /communities/{communityId}/posts/{postId}/photo          — Get post photo
 * - POST   /communities/{communityId}/posts/{postId}/replies        — Reply to post
 * - POST   /users/{userId}/communities/{communityId}/storage/sas    — Get SAS token
 * - GET    /users/{userId}/communities/{communityId}/storage/content — List files
 * - DELETE /users/{userId}/communities/{communityId}/files/{fileId}  — Delete file
 * - GET    /users/{userId}/communities/{communityId}/files/{fileId}/download — Download file
 */

// ============================================
// GENERIC API RESPONSE
// ============================================

export interface ApiResponse<T> {
  isSuccess: boolean;
  message?: string;
  errors?: string[];
  data: T;
}

// ============================================
// COMMUNITY
// ============================================

export interface Community {
  id: string;
  name: string;
  description?: string;
  joinCode?: string;
  createdAt?: string;
  isAdmin?: boolean;
  photoId?: string;
  photoUrl?: string;
}

export interface CreateCommunityRequest {
  name: string;
  description?: string;
  userIds?: string[];
}

// ============================================
// LEADERBOARD
// ============================================

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

// ============================================
// POSTS
// ============================================

export interface Post {
  id: string;
  title: string;
  content: string;
  authorUserId: string;
  authorName: string;
  authorPhotoUrl?: string;
  photoUrl?: string;
  createdAt: string;
  replyCount: number;
  replies: Reply[];
}

export interface Reply {
  id: string;
  content: string;
  authorUserId: string;
  authorName: string;
  authorPhotoUrl?: string;
  createdAt: string;
  parentReplyId?: string;
  childReplies: Reply[];
}

export interface CreateReplyRequest {
  content: string;
  parentReplyId?: string;
}

// ============================================
// COMMUNITY STORAGE
// ============================================

export interface CommunityFile {
  id: string;
  fileName: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
}
