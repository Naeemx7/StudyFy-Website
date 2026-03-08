/**
 * Authentication Models (DTOs)
 *
 * DTO = Data Transfer Object
 * These interfaces define the EXACT shape of data we send to and receive from the backend.
 *
 * WHY THIS FILE EXISTS:
 * - TypeScript can catch errors before you run the app
 * - Your IDE will autocomplete field names
 * - Team members know exactly what each API expects
 *
 * These match the Apidog documentation for /Register and /Login endpoints.
 */

// ============================================
// REQUEST DTOs (What we SEND to the backend)
// ============================================

/**
 * Valid target values for registration
 * These are the primary learning objectives a user can select
 *
 * Backend expects INTEGER values:
 * 0 = General Learning
 * 1 = Academic Research
 * 2 = Language Acquisition
 */
export type TargetType = 0 | 1 | 2;

export const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'General Learning' },
  { value: '1', label: 'Academic Research' },
  { value: '2', label: 'Language Acquisition' }
];

/**
 * Data sent to POST /Register endpoint
 *
 * Required fields: email, password, confirmPassword, target
 * Optional fields: userName, age, isStudent
 */
export interface RegisterRequest {
  userName?: string;          // Optional: Display name
  email: string;              // Required: Must be valid email format
  password: string;           // Required: Must meet password rules (see below)
  confirmPassword: string;    // Required: Must match password exactly
  target: TargetType;         // Required: Learning objective (0, 1, or 2)
  age?: number;               // Optional: User's age
  isStudent?: boolean;        // Optional: true = student, false = professional
}

/**
 * Password Requirements (from backend):
 * - Minimum 6 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (@$!%*?&)
 *
 * Regex: ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$
 */

/**
 * Data sent to POST /Login endpoint
 *
 * Both fields are required.
 */
export interface LoginRequest {
  userName: string;   // Required: The username (could be email based on backend config)
  password: string;   // Required: User's password
}

/**
 * Data sent to POST /ResendConfirmationEmail endpoint
 * Matches OpenAPI SendEmailDto
 */
export interface SendEmailRequest {
  email: string;
}

/**
 * Data sent to POST /ForgotPassword endpoint
 * Matches OpenAPI ForgotPasswordDto
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Data sent to POST /ValidateOTP endpoint
 * Matches OpenAPI ValidateOTPDto
 */
export interface ValidateOTPRequest {
  email: string;
  otp: string;
}

/**
 * Data sent to POST /ResetPassword endpoint
 * Matches OpenAPI ResetPasswordDto
 *
 * The reset token is passed as a query parameter, not in the body.
 */
export interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Data sent to POST /GoogleSignIn endpoint
 * Matches OpenAPI GoogleSignInDto
 *
 * token: The Google ID token from Google Identity Services
 * age, isStudent, target: Required profile fields
 */
export interface GoogleSignInRequest {
  token: string;           // Google ID token (JWT from Google)
  age: number;             // User's age
  isStudent: boolean;      // true = student, false = professional
  target: string;          // Learning objective ("0", "1", or "2")
}


// ============================================
// RESPONSE DTOs (What we RECEIVE from backend)
// ============================================

/**
 * Generic API response wrapper
 * Most endpoints return this structure
 */
export interface GeneralResponse {
  isSuccess: boolean;     // true = operation worked, false = error occurred
  message: string;        // Human-readable message (success or error description)
  errors?: string[];      // Optional: List of specific error messages
  data?: {                // Optional: Extra data (e.g. ValidateOTP returns { token: "..." })
    token?: string;
    [key: string]: unknown;
  };
}

/**
 * User data returned from backend
 * This is inside the AuthResponse after login
 */
export interface UserResponse {
  id: string;             // Unique user ID (UUID format)
  userName: string;       // Display name
  email: string;          // Email address
  age?: number;           // User's age (if provided during registration)
  isStudent?: boolean;    // true = student, false = professional
  target?: string;        // Learning goal
}

/**
 * Response from POST /Login endpoint
 * Contains user data + JWT token for authentication
 */
export interface AuthResponse {
  isSuccess: boolean;     // true = login successful
  message: string;        // Success/error message
  user: UserResponse;     // User details
  jwtToken: string;       // JWT token - IMPORTANT: Send this with every API request
  jwtExpiration: string;  // When the token expires (ISO date string)
}


// ============================================
// FRONTEND USER MODEL
// ============================================

/**
 * User model used throughout the Angular app
 * This is what we store in memory/localStorage after login
 *
 * Combines UserResponse data with the JWT token
 */
export interface User {
  id: string;
  userName: string;
  email: string;
  age?: number;
  isStudent: boolean;     // true = student, false = professional
  target?: string;
  token: string;          // JWT token
  tokenExpiration: Date;  // When token expires
}
