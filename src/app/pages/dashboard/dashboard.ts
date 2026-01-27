import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { NavbarComponent } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';
import { SpaceService } from '../../services/space.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  private auth = inject(AuthService);
  private spaceService = inject(SpaceService);
  private fb = inject(FormBuilder);

  currentUser$ = this.auth.currentUser$;
  spaces$ = this.spaceService.spaces$;
  
  // UI State for Modal
  showCreateModal = false;
  isCreating = false;

  // Form for creating a space
  createSpaceForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.maxLength(100)]]
  });

  openCreateModal() {
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.createSpaceForm.reset();
  }

  onCreateSpace() {
    if (this.createSpaceForm.invalid) return;

    this.isCreating = true;
    const { title, description } = this.createSpaceForm.value;

    this.spaceService.createSpace(title, description).subscribe({
      next: () => {
        this.isCreating = false;
        this.closeCreateModal();
      },
      error: () => console.error('Failed to create space')
    });
  }
}
