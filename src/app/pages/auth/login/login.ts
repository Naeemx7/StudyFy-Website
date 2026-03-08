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

import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, FormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { TARGET_OPTIONS } from '../../../models/auth.models';
import { environment } from '../../../../environments/environment';

// Declare the google global object from Google Identity Services
declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  resendForm: FormGroup;
  showResendForm = false;
  resendLoading = false;
  resendSuccess = '';
  resendError = '';

  // Forgot password state
  showForgotPassword = false;
  forgotStep: 'email' | 'otp' | 'reset' = 'email';
  forgotEmailForm: FormGroup;
  forgotOtpForm: FormGroup;
  forgotResetForm: FormGroup;
  forgotLoading = false;
  forgotSuccess = '';
  forgotError = '';
  forgotEmail = '';
  resetToken = '';

  loading = false;
  error = '';
  registrationMessage = '';  // Message shown after successful registration

  // Google Sign-In state
  googleLoading = false;
  googleToken: string | null = null;
  showGoogleProfileForm = false;
  selectedRole: 'student' | 'professional' = 'student';
  targetOptions = TARGET_OPTIONS;
  googleProfileForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone
  ) {
    // Form fields match what backend expects
    this.loginForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.resendForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.forgotEmailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.forgotOtpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.forgotResetForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6), this.passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.googleProfileForm = this.fb.group({
      isStudent: [true, Validators.required],
      target: ['', Validators.required],
      age: [null]
    });
  }

  // Typed getters for Google profile form controls (avoids AbstractControl template errors)
  get googleTargetControl(): FormControl { return this.googleProfileForm.get('target') as FormControl; }
  get googleAgeControl(): FormControl { return this.googleProfileForm.get('age') as FormControl; }

  ngOnInit(): void {
    this.initializeGoogleSignIn();

    this.route.queryParams.subscribe(params => {
      // Check if redirected from registration
      if (params['registered'] === 'true') {
        const email = params['email'] || 'your email';
        this.registrationMessage = `Account created! Please check ${email} to verify your account before logging in.`;
      }

      // Check if token is in the URL (e.g. from email link or manual entry)
      if (params['token']) {
        this.resetToken = params['token'];
        console.log('Token found in URL query params:', this.resetToken);
        // Also grab email from URL if provided
        if (params['email']) {
          this.forgotEmail = params['email'];
        }
        // Auto-open the forgot password modal at the reset step
        this.showForgotPassword = true;
        this.forgotStep = 'reset';
        this.forgotSuccess = 'Token loaded. Enter your new password below.';
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

  // ===== Google Sign-In Flow =====

  private initializeGoogleSignIn(): void {
    if (typeof google === 'undefined') {
      setTimeout(() => this.initializeGoogleSignIn(), 200);
      return;
    }

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => {
        this.ngZone.run(() => this.handleGoogleCredential(response));
      }
    });
  }

  signInWithGoogle(): void {
    if (typeof google === 'undefined') {
      this.error = 'Google Sign-In is not ready yet. Please try again.';
      return;
    }

    this.error = '';
    this.googleLoading = true;

    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        this.ngZone.run(() => {
          this.googleLoading = false;
          const btnDiv = document.getElementById('google-login-btn');
          if (btnDiv) {
            google.accounts.id.renderButton(btnDiv, {
              type: 'standard',
              theme: 'filled_black',
              size: 'large',
              width: '100%'
            });
            const btn = btnDiv.querySelector('div[role="button"]') as HTMLElement;
            if (btn) btn.click();
          }
        });
      }
    });
  }

  private handleGoogleCredential(response: any): void {
    this.googleToken = response.credential;
    this.googleLoading = false;

    if (!this.googleToken) {
      this.error = 'Failed to get Google credential. Please try again.';
      return;
    }

    // Show profile completion form (backend requires age, target, isStudent)
    this.showGoogleProfileForm = true;
    this.registrationMessage = '';
  }

  selectRole(role: 'student' | 'professional'): void {
    this.selectedRole = role;
    this.googleProfileForm.get('isStudent')?.setValue(role === 'student');
  }

  submitGoogleSignIn(): void {
    const target = this.googleProfileForm.get('target')?.value;
    const age = this.googleProfileForm.get('age')?.value;

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
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || 'Google sign-in failed. Please try again.';
      }
    });
  }

  cancelGoogleSignIn(): void {
    this.showGoogleProfileForm = false;
    this.googleToken = null;
    this.error = '';
  }

  // ===== Forgot Password Flow =====

  openForgotPassword(): void {
    this.showForgotPassword = true;
    this.forgotStep = 'email';
    this.forgotError = '';
    this.forgotSuccess = '';
    this.forgotEmailForm.reset();
    this.forgotOtpForm.reset();
    this.forgotResetForm.reset();
    this.resetToken = '';
  }

  closeForgotPassword(): void {
    this.showForgotPassword = false;
    this.forgotError = '';
    this.forgotSuccess = '';
  }

  onForgotEmailSubmit(): void {
    if (this.forgotEmailForm.invalid) {
      this.forgotEmailForm.markAllAsTouched();
      return;
    }

    this.forgotLoading = true;
    this.forgotError = '';
    this.forgotSuccess = '';
    this.forgotEmail = this.forgotEmailForm.value.email;

    this.auth.forgotPassword(this.forgotEmail).subscribe({
      next: (res) => {
        this.forgotLoading = false;
        this.forgotSuccess = res.message || 'OTP sent to your email.';
        this.forgotStep = 'otp';
      },
      error: (err: Error) => {
        this.forgotLoading = false;
        this.forgotError = err.message || 'Failed to send OTP.';
      }
    });
  }

  onForgotOtpSubmit(): void {
    if (this.forgotOtpForm.invalid) {
      this.forgotOtpForm.markAllAsTouched();
      return;
    }

    this.forgotLoading = true;
    this.forgotError = '';
    this.forgotSuccess = '';

    const otp = this.forgotOtpForm.value.otp.trim();

    this.auth.validateOTP(this.forgotEmail, otp).subscribe({
      next: (res) => {
        this.forgotLoading = false;
        console.log('Full ValidateOTP response:', JSON.stringify(res, null, 2));

        // Extract the reset token from the response.
        // The backend returns "OTP is valid" in message (human text),
        // and the actual reset token in errors[0].
        const token = this.extractToken(res);
        if (token) {
          this.resetToken = token;
          console.log('Token extracted successfully:', this.resetToken.substring(0, 30) + '...');
        } else {
          console.warn('Could not find token in response. User will need to paste it manually.');
        }

        // Pre-fill token in reset form
        this.forgotSuccess = 'OTP verified successfully.';
        this.forgotStep = 'reset';
      },
      error: (err: Error) => {
        this.forgotLoading = false;
        this.forgotError = err.message || 'Invalid OTP.';
      }
    });
  }

  onForgotResetSubmit(): void {
    if (this.forgotResetForm.invalid) {
      this.forgotResetForm.markAllAsTouched();
      return;
    }

    this.forgotLoading = true;
    this.forgotError = '';
    this.forgotSuccess = '';

    const { newPassword, confirmPassword } = this.forgotResetForm.value;

    // Use the email from step 1 or from the direct input
    const email = this.forgotEmail;
    if (!email) {
      this.forgotLoading = false;
      this.forgotError = 'Please enter your email address.';
      return;
    }

    if (!this.resetToken) {
      this.forgotLoading = false;
      this.forgotError = 'Reset token is missing. Please restart the process.';
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      this.forgotLoading = false;
      this.forgotError = 'Password must only contain letters, digits, and @$!%*?& — with at least one uppercase, lowercase, digit, and special character.';
      return;
    }

    if (newPassword !== confirmPassword) {
      this.forgotLoading = false;
      this.forgotError = 'Passwords do not match.';
      return;
    }

    this.auth.resetPassword(email, newPassword, confirmPassword, this.resetToken).subscribe({
      next: (res) => {
        this.forgotLoading = false;
        this.forgotSuccess = res.message || 'Password reset successfully! You can now log in.';
        setTimeout(() => this.closeForgotPassword(), 3000);
      },
      error: (err: Error) => {
        this.forgotLoading = false;
        const msg = err.message || '';
        if (msg.toLowerCase().includes('token')) {
          this.forgotError = 'Reset password failed. Please restart the process and try again.';
        } else {
          this.forgotError = msg || 'Password reset failed.';
        }
      }
    });
  }

  private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const v = control.value;
    if (!v) return null;
    const valid = /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v) && /[@$!%*?&]/.test(v);
    return valid ? null : { passwordStrength: true };
  }

  private passwordMatchValidator(form: AbstractControl): ValidationErrors | null {
    const pw = form.get('newPassword')?.value;
    const cpw = form.get('confirmPassword')?.value;
    return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
  }

  /**
   * Extract the reset token from the ValidateOTP response.
   *
   * The backend returns:
   *   - data.token: "CfDJ8NTvk4Bmz5..." (the actual reset token)
   *   - message: "OTP is valid" (human-readable text)
   */
  private extractToken(res: { message?: string; errors?: string[]; data?: { token?: string; [key: string]: unknown } }): string | null {
    // The token is in data.token
    if (res.data && typeof res.data.token === 'string' && res.data.token.length > 0) {
      return res.data.token;
    }

    // Fallback: check if it's somewhere else
    const looksLikeToken = (s: string): boolean => s.length > 20;

    if (res.errors && res.errors.length > 0) {
      for (const item of res.errors) {
        if (looksLikeToken(item)) return item;
      }
    }

    if (res.message && looksLikeToken(res.message) && res.message !== 'OTP is valid') {
      return res.message;
    }

    return null;
  }

  get resetPasswordMismatch(): boolean {
    return this.forgotResetForm.hasError('passwordMismatch') &&
           this.forgotResetForm.get('confirmPassword')?.touched === true;
  }

  toggleResendForm(): void {
    this.showResendForm = !this.showResendForm;
  }

  onResendEmail(): void {
    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }

    this.resendLoading = true;
    this.resendError = '';
    this.resendSuccess = '';
    this.forgotEmail = this.resendForm.value.email;

    this.auth.forgotPassword(this.forgotEmail).subscribe({
      next: (res) => {
        this.resendLoading = false;
        this.resendSuccess = res.message || 'OTP sent to your email.';
      },
      error: (err: Error) => {
        this.resendLoading = false;
        this.resendError = err.message || 'Failed to send OTP.';
      }
    });
  }
}
