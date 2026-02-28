/**
 * Login Component
 * 
 * Handles user authentication.
 * 
 * WHAT THIS PAGE DOES:
 * 1. Collects username and password
 * 2. Sends to POST /Login endpoint
 * 3. On success: stores JWT token, redirects to dashboard
 * 4. On failure: shows error message
 * 
 * NOTE: The backend expects 'userName', not 'email'.
 * Users should enter their username to log in.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  error = '';
  registrationMessage = '';  // Message shown after successful registration

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Form fields match what backend expects
    this.loginForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    // Check if redirected from registration
    this.route.queryParams.subscribe(params => {
      if (params['registered'] === 'true') {
        const email = params['email'] || 'your email';
        this.registrationMessage = `Account created! Please check ${email} to verify your account before logging in.`;
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    
    this.loading = true;
    this.error = '';
    
    const { userName, password } = this.loginForm.value;
    
    this.auth.login(userName, password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || 'Login failed. Please try again.';
      }
    });
  }

  /**
   * Helper: Check if a field has an error
   */
  hasError(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }
}
