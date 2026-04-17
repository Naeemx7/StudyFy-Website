/**
 * Dashboard Component
 * 
 * The main hub after login. Shows:
 * - Welcome message with user's name
 * - Quick stats (hardcoded for now)
 * - List of user's spaces (from API)
 * - Create new space button/modal
 * 
 * DATA FLOW:
 * 1. Component initializes (ngOnInit)
 * 2. Calls spaceService.loadSpaces() to fetch from API
 * 3. Subscribes to spaces$ to display the list
 * 4. When user creates space, calls spaceService.createSpace()
 */

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { NavbarComponent } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';
import { SpaceService } from '../../services/space.service';
import { Space } from '../../models/space.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private spaceService = inject(SpaceService);
  private fb = inject(FormBuilder);

  // User data from auth service
  currentUser$ = this.auth.currentUser$;
  
  // Spaces data from space service
  spaces$ = this.spaceService.spaces$;
  spacesLoading$ = this.spaceService.loading$;
  spacesError$ = this.spaceService.error$;
  
  // UI State for Modal
  showCreateModal = false;
  isCreating = false;
  createError = '';

  // UI State for Delete Modal
  showDeleteModal = false;
  isDeleting = false;
  deleteError = '';
  spaceToDelete: Space | null = null;

  // Form for creating a space
  createSpaceForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.maxLength(200)]]
  });

  /**
   * ngOnInit - Called when component initializes
   * This is where we load data from APIs
   */
  ngOnInit(): void {
    // Load spaces from backend
    this.spaceService.loadSpaces().subscribe();
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.createError = '';
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.createSpaceForm.reset();
    this.createError = '';
  }

  onCreateSpace() {
    if (this.createSpaceForm.invalid) return;

    this.isCreating = true;
    this.createError = '';
    
    const { name, description } = this.createSpaceForm.value;

    this.spaceService.createSpace(name, description || '').subscribe({
      next: () => {
        this.isCreating = false;
        this.closeCreateModal();
      },
      error: (err) => {
        this.isCreating = false;
        this.createError = err?.message || 'Failed to create space';
      }
    });
  }

  /**
   * CONFIRM DELETE SPACE
   * Opens the delete confirmation modal
   * @param space - The space to delete
   * @param event - Click event (to prevent navigation)
   */
  confirmDeleteSpace(space: Space, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.spaceToDelete = space;
    this.showDeleteModal = true;
    this.deleteError = '';
  }

  /**
   * CANCEL DELETE
   * Closes the delete modal without deleting
   */
  cancelDelete() {
    this.showDeleteModal = false;
    this.spaceToDelete = null;
    this.deleteError = '';
  }

  /**
   * DELETE SPACE
   * Calls the API to delete the space
   */
  deleteSpace() {
    if (!this.spaceToDelete) return;

    this.isDeleting = true;
    this.deleteError = '';

    this.spaceService.deleteSpace(this.spaceToDelete.id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.spaceToDelete = null;
      },
      error: (err) => {
        this.isDeleting = false;
        this.deleteError = err?.message || 'Failed to delete space';
      }
    });
  }

  /**
   * Get display-friendly name
   * For Google users who sign in with email, strips the @domain part
   */
  getDisplayName(userName: string | undefined): string {
    if (!userName) return 'User';
    return userName.includes('@') ? userName.split('@')[0] : userName.split(' ')[0] || userName;
  }
}
