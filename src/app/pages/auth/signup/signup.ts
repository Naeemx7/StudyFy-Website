/**
 * Signup Component
 *
 * Handles user registration.
 *
 * WHAT THIS PAGE DOES:
 * 1. Collects user information (name, email, password, etc.)
 * 2. Validates the form before submission
 * 3. Sends data to POST /Register endpoint
 * 4. On success: redirects to login page (user needs to log in)
 * 5. On failure: shows error message
 *
 * FORM FIELDS:
 * - userName: Display name (required)
 * - email: Email address (required)
 * - password: Must have uppercase, lowercase, number, special char (required)
 * - confirmPassword: Must match password (required)
 * - isStudent: true for student, false for professional (required)
 * - age: Optional number
 * - target: Optional learning goal
 */

import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { RegisterRequest, TARGET_OPTIONS } from '../../../models/auth.models';
import { environment } from '../../../../environments/environment';

// Declare the google global object from Google Identity Services
declare const google: any;

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class SignupComponent implements OnInit {
  // Track which role card is selected (for visual feedback)
  selectedRole: 'student' | 'professional' = 'student';

  // Expose target options to template
  targetOptions = TARGET_OPTIONS;

  // The reactive form with all fields
  signupForm: FormGroup;

  // UI state
  loading = false;
  error = '';
  successMessage = '';

  // Google Sign-In state
  googleLoading = false;
  googleToken: string | null = null;
  showGoogleProfileForm = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) {
    // Build the form with validators
    this.signupForm = this.fb.group({
      // Required fields
      userName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.pattern(/^\S+$/)  // No spaces allowed in username
      ]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        // Custom validator for password strength
        this.passwordStrengthValidator
      ]],
      confirmPassword: ['', [Validators.required]],
      isStudent: [true, Validators.required],  // Default: student
      target: ['', [Validators.required]],   // Required: Must select learning objective (0, 1, or 2)

      // Optional fields
      age: [null]  // null = not provided
    }, {
      // Form-level validator to check passwords match
      validators: this.passwordMatchValidator
    });
  }

  /**
   * Initialize Google Sign-In button on component load
   */
  ngOnInit(): void {
    this.initializeGoogleSignIn();
  }

  /**
   * Initialize Google Identity Services
   * Renders the Google One Tap or button
   */
  private initializeGoogleSignIn(): void {
    // Wait for the GIS script to load
    if (typeof google === 'undefined') {
      // Script not loaded yet, retry after a short delay
      setTimeout(() => this.initializeGoogleSignIn(), 200);
      return;
    }

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => {
        // Google returns the credential (ID token) here
        // NgZone.run ensures Angular change detection picks up changes
        this.ngZone.run(() => this.handleGoogleCredential(response));
      }
    });
  }

  /**
   * Trigger Google Sign-In popup
   * Called when user clicks the Google button
   */
  signInWithGoogle(): void {
    if (typeof google === 'undefined') {
      this.error = 'Google Sign-In is not ready yet. Please try again.';
      return;
    }

    this.error = '';
    this.googleLoading = true;

    // Use the popup flow
    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap not available, fall back to button click flow
        // We'll use the popup picker instead
        this.ngZone.run(() => {
          this.googleLoading = false;
          // Render a temporary hidden button and click it
          const btnDiv = document.getElementById('google-signin-btn');
          if (btnDiv) {
            google.accounts.id.renderButton(btnDiv, {
              type: 'standard',
              theme: 'filled_black',
              size: 'large',
              width: '100%'
            });
            // Click the rendered button
            const btn = btnDiv.querySelector('div[role="button"]') as HTMLElement;
            if (btn) btn.click();
          }
        });
      }
    });
  }

  /**
   * Handle the Google credential response
   * If this is a new user, we need profile info (age, target, etc.)
   * before sending to backend
   */
  private handleGoogleCredential(response: any): void {
    this.googleToken = response.credential;
    this.googleLoading = false;

    if (!this.googleToken) {
      this.error = 'Failed to get Google credential. Please try again.';
      return;
    }

    // Show the profile completion form for new Google users
    this.showGoogleProfileForm = true;
    this.successMessage = 'Google account verified! Complete your profile below.';
  }

  /**
   * Submit Google Sign-In with profile data
   * Called after user fills in required fields (age, target, role)
   */
  submitGoogleSignIn(): void {
    const target = this.signupForm.get('target')?.value;
    const age = this.signupForm.get('age')?.value;

    if (!target) {
      this.error = 'Please select your learning goal.';
      return;
    }

    if (!this.googleToken) {
      this.error = 'Google token expired. Please sign in with Google again.';
      this.showGoogleProfileForm = false;
      return;
    }

    this.loading = true;
    this.error = '';

    this.auth.googleSignIn(
      this.googleToken,
      age || 0,
      this.selectedRole === 'student',
      target
    ).subscribe({
      next: () => {
        this.loading = false;
        // Google sign-in auto-logs in (returns JWT), go straight to dashboard
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || 'Google sign-in failed. Please try again.';
      }
    });
  }

  /**
   * Custom validator: Check password strength
   *
   * Password must have:
   * - At least 1 uppercase letter
   * - At least 1 lowercase letter
   * - At least 1 number
   * - At least 1 special character (@$!%*?&)
   */
  passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;  // Let required validator handle empty

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[@$!%*?&]/.test(value);

    const valid = hasUpperCase && hasLowerCase && hasNumber && hasSpecial;

    return valid ? null : {
      passwordStrength: {
        hasUpperCase,
        hasLowerCase,
        hasNumber,
        hasSpecial
      }
    };
  }

  /**
   * Form-level validator: Check passwords match
   */
  passwordMatchValidator(form: AbstractControl): ValidationErrors | null {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  /**
   * Handle role card selection
   * Updates both the visual state and form value
   */
  selectRole(role: 'student' | 'professional') {
    this.selectedRole = role;
    // isStudent: true if student, false if professional
    this.signupForm.get('isStudent')?.setValue(role === 'student');
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    // Don't submit if form is invalid
    if (this.signupForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.signupForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    this.successMessage = '';

    // Build the request object - send directly, NOT wrapped in "req"
    const formValue = this.signupForm.value;
    const registerData = {
      userName: formValue.userName,
      email: formValue.email,
      password: formValue.password,
      confirmPassword: formValue.confirmPassword,
      isStudent: formValue.isStudent,
      target: formValue.target,  // String: "0", "1", or "2"
      // Only include optional fields if they have values
      ...(formValue.age ? { age: formValue.age } : {})
    };

    // Log the data being sent (for debugging)
    console.log('Sending registration data:', registerData);

    // Call the API
    this.auth.register(registerData).subscribe({
      next: (response) => {
        console.log('Registration success:', response);
        this.loading = false;
        this.successMessage = response.message || 'Registration successful! Please check your email.';

        // Redirect to login after 3 seconds, with message to show on login page
        setTimeout(() => {
          this.router.navigate(['/login'], {
            queryParams: {
              registered: 'true',
              email: formValue.email
            }
          });
        }, 3000);
      },
      error: (err) => {
        console.error('Registration error:', err);
        this.loading = false;
        this.error = err?.message || 'Registration failed. Please try again.';
      }
    });
  }

  /**
   * Helper: Check if a field has an error
   */
  hasError(fieldName: string): boolean {
    const field = this.signupForm.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }

  /**
   * Helper: Check if passwords don't match
   */
  get passwordMismatch(): boolean {
    return this.signupForm.hasError('passwordMismatch') &&
           this.signupForm.get('confirmPassword')?.touched === true;
  }
}
