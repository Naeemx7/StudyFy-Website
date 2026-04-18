/**
 * Space Models (DTOs)
 * 
 * A "Space" is a study subject container (e.g., "Operating Systems", "French A1").
 * Users can have multiple spaces, each containing files and quizzes.
 * 
 * These match the Apidog documentation for:
 * - POST /users/{userId}/spaces (create)
 * - GET /users/{userId}/spaces (list all)
 * - GET /users/{userId}/spaces/{workspaceId} (get one)
 * - DELETE /users/{userId}/spaces/{workspaceId} (delete)
 */

// ============================================
// REQUEST DTOs (What we SEND to the backend)
// ============================================

/**
 * Data sent to POST /users/{userId}/spaces endpoint
 * Creates a new study space
 */
export interface CreateSpaceRequest {
  name: string;           // Required: Name of the space (e.g., "Data Structures")
  description?: string;   // Optional: Brief description or goal
}


// ============================================
// RESPONSE DTOs (What we RECEIVE from backend)
// ============================================

/**
 * Response from POST /users/{userId}/spaces
 * Also the shape of each item in GET /users/{userId}/spaces array
 * 
 * NOTE: Backend returns "spaceId" for GET list, but might return "workspaceId" for CREATE
 * We handle BOTH field names to be safe
 */
export interface SpaceResponse {
  spaceId?: string;       // Used by GET /spaces (list)
  workspaceId?: string;   // Used by POST /spaces (create) - per API docs
  name: string;           // Space name
  description?: string;   // Space description
  createdAt?: string;     // When the space was created
  totalFiles?: number;    // Number of files in the space
  totalQuizzes?: number;  // Number of quizzes taken
  averageScore?: number;  // Average quiz score
}

/**
 * Response from GET /users/{userId}/spaces
 * Returns an array of spaces
 */
export interface SpacesListResponse {
  isSuccess: boolean;
  message: string;
  data: SpaceResponse[];  // Array of user's spaces
}


// ============================================
// FRONTEND SPACE MODEL
// ============================================

/**
 * Space model used throughout the Angular app
 * 
 * NOTE: We map backend field names to frontend-friendly names:
 * - workspaceId → id
 * - name → title (to match existing UI)
 * 
 * We also add frontend-only fields for UI purposes.
 */
export interface Space {
  id: string;             // Mapped from workspaceId
  title: string;          // Mapped from name
  description: string;    // Same as backend
  
  progress: number;       // 0-100 percentage (normalised from averageScore)
  totalFiles: number;     // Total files in this space (from spaces API)
  totalQuizzes: number;   // Total quizzes taken in this space (from spaces API)
  lastAccessed: Date;     // When user last opened this space
}

/**
 * Helper function to convert backend SpaceResponse to frontend Space
 * 
 * WHY THIS EXISTS:
 * Backend uses different field names (workspaceId, name).
 * Our UI expects (id, title).
 * This function translates between them.
 * 
 * HANDLES BOTH:
 * - GET /spaces returns "spaceId"
 * - POST /spaces might return "workspaceId" (per API docs)
 */
export function mapSpaceResponseToSpace(response: SpaceResponse): Space {
  // Handle both spaceId and workspaceId - backend is inconsistent
  const id = response.spaceId || response.workspaceId || '';
  
  if (!id) {
    console.error('Space response missing both spaceId and workspaceId:', response);
  }
  
  // Normalise averageScore: backend may return 0-1 decimal (0.725) or 0-100 (72.5)
  const rawScore = response.averageScore ?? 0;
  const progress = rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);

  return {
    id,
    title: response.name,
    description: response.description || '',
    progress,
    totalFiles: response.totalFiles ?? 0,
    totalQuizzes: response.totalQuizzes ?? 0,
    lastAccessed: response.createdAt ? new Date(response.createdAt) : new Date()
  };
}
