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
 */
export interface SpaceResponse {
  workspaceId: string;    // Unique ID (UUID format) - NOTE: Backend calls it "workspaceId"
  name: string;           // Space name
  description?: string;   // Space description
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
  
  // Frontend-only fields (not from backend yet)
  // These will be populated from quiz/analytics data later
  progress: number;       // 0-100 percentage (calculated from quiz results)
  lastAccessed: Date;     // When user last opened this space
}

/**
 * Helper function to convert backend SpaceResponse to frontend Space
 * 
 * WHY THIS EXISTS:
 * Backend uses different field names (workspaceId, name).
 * Our UI expects (id, title).
 * This function translates between them.
 */
export function mapSpaceResponseToSpace(response: SpaceResponse): Space {
  return {
    id: response.workspaceId,
    title: response.name,
    description: response.description || '',
    // Default values for frontend-only fields
    progress: 0,
    lastAccessed: new Date()
  };
}
