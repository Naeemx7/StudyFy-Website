/**
 * Storage Models (DTOs)
 * 
 * These models handle file upload/download to Azure Blob Storage.
 * 
 * HOW FILE UPLOAD WORKS:
 * 1. Frontend asks backend for SAS URL (temporary upload permission)
 * 2. Backend returns SAS URLs with built-in auth tokens
 * 3. Frontend uploads file directly to Azure using writeSasUri
 * 4. Backend can later read the file with readSasUri
 * 
 * SAS = Shared Access Signature (like a temporary password for Azure storage)
 */

// ============================================
// REQUEST DTOs (What we SEND to the backend)
// ============================================

/**
 * Request to get SAS URLs for file upload
 * POST /users/{userId}/spaces/{workspaceId}/storage/sas
 */
export interface GetSasRequest {
  fileNames: string[];  // Array of filenames to upload (e.g., ["lecture1.pdf", "notes.pdf"])
}


// ============================================
// RESPONSE DTOs (What we RECEIVE from backend)
// ============================================

/**
 * SAS URLs returned by the backend
 * These are temporary URLs with authentication built-in
 */
export interface SasData {
  /** URLs for downloading/reading files (GET requests) */
  readSasUris: Record<string, string>;   // { "lecture1.pdf": "https://azure...?sig=xxx" }
  
  /** URLs for uploading files (PUT requests) */
  writeSasUris: Record<string, string>;  // { "lecture1.pdf": "https://azure...?sig=xxx" }
}

/**
 * Response from POST /storage/sas endpoint
 */
export interface SasResponse {
  isSuccess: boolean;
  message: string;
  errors?: string[];
  data: SasData;
}

/**
 * File content data returned after processing
 * The backend extracts text from PDFs
 */
export interface FileContent {
  fileName: string;              // Original filename
  fileId: string;                // UUID assigned by backend
  result: unknown;               // Extracted text content (varies by file type)
  tags?: string[];               // Topic tags extracted by backend AI
}

/**
 * Response from GET /storage/content endpoint
 */
export interface FileContentResponse {
  isSuccess: boolean;
  message: string;
  errors?: string[];
  data: FileContent;
}


// ============================================
// FRONTEND MODELS
// ============================================

/**
 * File model used in the frontend
 * Represents a file uploaded to a space
 */
export interface SpaceFile {
  id: string;           // fileId from backend
  name: string;         // filename
  readUrl?: string;     // SAS URL for viewing the file
  uploadedAt: Date;     // When file was uploaded
  size?: number;        // File size in bytes (if available)
  type?: string;        // MIME type (e.g., "application/pdf")
}

/**
 * Upload progress tracking
 */
export interface UploadProgress {
  fileName: string;
  progress: number;     // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}
