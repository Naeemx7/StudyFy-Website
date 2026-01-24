import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
}) 
export class SignupComponent {
  selectedRole: 'student' | 'professional' = 'student';
  signupForm: FormGroup;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      role: [this.selectedRole, Validators.required]
    });
  }

  selectRole(role: 'student' | 'professional') {
    this.selectedRole = role;
    this.signupForm.get('role')?.setValue(role);
  }

  onSubmit(): void {
    if (this.signupForm.invalid) return;
    this.loading = true;
    this.error = '';
    const { name, email, password, role } = this.signupForm.value;
    this.auth.signup(name, email, password, role).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || 'Signup failed. Please try again.';
      }
    });
  }
}