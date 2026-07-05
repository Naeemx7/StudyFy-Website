/**
 * Storage Service
 * 
 * Handles file upload/download to Azure Blob Storage.
 * 
 * HOW IT WORKS:
 * 1. Call getSasUrls() with filenames you want to upload
 * 2. Backend returns temporary SAS URLs (valid ~15 minutes)
 * 3. Call uploadToAzure() with the file and writeSasUri
 * 4. File is now stored in Azure blob storage!
 * 5. Call getFileContent() to get extracted text (after backend processes it)
 * 
 * WHY TWO STEPS FOR UPLOAD?
 * - Security: Backend controls who can upload (via JWT auth)
 * - Scalability: Large files go directly to Azure, not through backend server
 * - Cost: Azure handles bandwidth, not your backend server
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, forkJoin, of, BehaviorSubject } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { BadgeService } from './badge.service';
import {
  GetSasRequest,
  SasResponse,
  SasData,
  FileContentResponse,
  FileContent,
  UploadProgress
} from '../models/storage.models';


@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private badgeService = inject(BadgeService);

  // Track upload progress for UI
  private uploadProgressSubject = new BehaviorSubject<UploadProgress[]>([]);
  readonly uploadProgress$ = this.uploadProgressSubject.asObservable();

  /**
   * GET SAS URLs
   * 
   * Requests temporary upload/download URLs from backend.
   * 
   * @param spaceId - The workspace ID to upload files to
   * @param fileNames - Array of filenames to get URLs for
   * @returns SAS URLs for reading and writing files
   * 
   * ENDPOINT: POST /users/{userId}/spaces/{spaceId}/storage/sas
   */
  getSasUrls(spaceId: string, fileNames: string[]): Observable<SasData> {
    const userId = this.auth.getCurrentUserId();
    
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }

    const request: GetSasRequest = { fileNames };
    const url = `${environment.apiUrl}/users/${userId}/spaces/${spaceId}/storage/sas`;

    return this.http.post<SasResponse>(url, request).pipe(
      map(response => {
        if (!response.isSuccess) {
          throw new Error(response.message || 'Failed to get upload URLs');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }


  /**
   * UPLOAD FILE TO AZURE
   * 
   * Uploads a file directly to Azure Blob Storage using the SAS URL.
   * This bypasses the backend completely - file goes straight to Azure.
   * 
   * @param file - The File object to upload
   * @param sasUrl - The writeSasUri from getSasUrls()
   * @returns Observable that completes when upload is done
   * 
   * NOTE: Azure expects specific headers for blob upload:
   * - x-ms-blob-type: BlockBlob
   * - Content-Type: the actual file type
   */
  uploadToAzure(file: File, sasUrl: string): Observable<void> {
    // Azure Blob Storage requires these headers for PUT upload
    const headers = new HttpHeaders({
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': file.type || 'application/octet-stream'
    });

    return this.http.put(sasUrl, file, { headers }).pipe(
      map(() => {
        return;
      }),
      catchError(error => {
        console.error('Azure upload error:', error);
        return throwError(() => new Error(`Failed to upload ${file.name}: ${error.message}`));
      })
    );
  }


  /**
   * UPLOAD MULTIPLE FILES
   * 
   * Convenience method to upload multiple files at once.
   * Gets SAS URLs for all files, then uploads each to Azure.
   * 
   * @param spaceId - The workspace to upload to
   * @param files - Array of File objects
   * @returns Observable that completes when all uploads are done
   * 
   * FLOW:
   * 1. Get SAS URLs for all filenames
   * 2. Upload each file to its writeSasUri
   * 3. Return fileIds for the uploaded files
   */
  uploadFiles(spaceId: string, files: File[]): Observable<string[]> {
    if (files.length === 0) {
      return of([]);
    }

    const fileNames = files.map(f => f.name);
    
    // Initialize progress tracking
    const progressList: UploadProgress[] = fileNames.map(name => ({
      fileName: name,
      progress: 0,
      status: 'pending'
    }));
    this.uploadProgressSubject.next(progressList);

    // Step 1: Get SAS URLs
    return this.getSasUrls(spaceId, fileNames).pipe(
      switchMap(sasData => {
        // Step 2: Upload each file to Azure
        const uploads = files.map((file) => {
          const sasUrl = sasData.writeSasUris[file.name];
          
          if (!sasUrl) {
            console.error('No SAS URL for file:', file.name);
            this.updateProgress(file.name, 0, 'error', 'No upload URL received');
            return throwError(() => new Error(`No upload URL for ${file.name}`));
          }

          this.updateProgress(file.name, 10, 'uploading');
          
          return this.uploadToAzure(file, sasUrl).pipe(
            tap(() => this.updateProgress(file.name, 100, 'completed')),
            catchError(err => {
              this.updateProgress(file.name, 0, 'error', err.message);
              return throwError(() => err);
            })
          );
        });

        // Wait for all uploads to complete
        return forkJoin(uploads).pipe(
          tap(() => this.badgeService.trackAction('FILE_UPLOADED', files.length)),
          map(() => fileNames)
        );
      }),
      catchError(error => {
        // Mark all as error if SAS request fails
        fileNames.forEach(name => this.updateProgress(name, 0, 'error', error.message));
        return throwError(() => error);
      })
    );
  }

  /**
   * GET FILE CONTENT
   * 
   * Gets the extracted text content of a file.
   * The backend processes PDFs and extracts readable text.
   * 
   * @param spaceId - The workspace ID
   * @param fileName - The filename to get content for
   * @returns The file content with fileId and extracted text
   * 
   * ENDPOINT: GET /users/{userId}/spaces/{spaceId}/storage/content?fileName={fileName}
   */
  getFileContent(spaceId: string, fileName: string): Observable<FileContent> {
    const userId = this.auth.getCurrentUserId();
    
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }

    const url = `${environment.apiUrl}/users/${userId}/spaces/${spaceId}/storage/content`;
    
    return this.http.get<FileContentResponse>(url, {
      params: { fileName }
    }).pipe(
      map(response => {
        if (!response.isSuccess) {
          throw new Error(response.message || 'Failed to get file content');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }


  /**
   * GET READ URL FOR FILE
   * 
   * Gets a temporary URL to view/download a file.
   * Useful for displaying PDFs in the workspace viewer.
   * 
   * @param spaceId - The workspace ID
   * @param fileName - The filename to get URL for
   * @returns The SAS URL for reading the file
   */
  getReadUrl(spaceId: string, fileName: string): Observable<string> {
    return this.getSasUrls(spaceId, [fileName]).pipe(
      map(sasData => {
        // Try readSasUri first, fall back to writeSasUri (often has read permission too)
        const readUrl = sasData.readSasUris?.[fileName] || sasData.writeSasUris?.[fileName];
        if (!readUrl) {
          throw new Error(`No SAS URL for ${fileName}`);
        }
        return readUrl;
      })
    );
  }

  /**
   * DELETE FILE
   * 
   * Deletes a file from a workspace.
   * 
   * @param spaceId - The workspace ID
   * @param fileId - The ID of the file to delete
   * 
   * ENDPOINT: DELETE /users/{userId}/workspaces/{workspaceId}/files/{fileId}
   */
  deleteFile(spaceId: string, fileId: string): Observable<void> {
    const userId = this.auth.getCurrentUserId();
    
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }

    const url = `${environment.apiUrl}/users/${userId}/workspaces/${spaceId}/files/${fileId}`;
    
    return this.http.delete<any>(url).pipe(
      map(response => {
        if (response && response.isSuccess === false) {
           throw new Error(response.message || 'Failed to delete file');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Update upload progress (internal helper)
   */
  private updateProgress(
    fileName: string, 
    progress: number, 
    status: UploadProgress['status'],
    error?: string
  ): void {
    const current = this.uploadProgressSubject.value;
    const updated = current.map(p => 
      p.fileName === fileName 
        ? { ...p, progress, status, error }
        : p
    );
    this.uploadProgressSubject.next(updated);
  }

  /**
   * Clear upload progress
   * Call after uploads complete or when leaving the page
   */
  clearProgress(): void {
    this.uploadProgressSubject.next([]);
  }

  /**
   * Error handler
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('Storage service error:', error);
    
    let message = 'An error occurred';
    
    if (error.status === 0) {
      message = 'Cannot connect to server';
    } else if (error.status === 400) {
      message = error.error?.message || 'Invalid request';
    } else if (error.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error.status === 404) {
      message = 'File or space not found';
    } else if (error.error?.message) {
      message = error.error.message;
    }
    
    return throwError(() => new Error(message));
  };
}
