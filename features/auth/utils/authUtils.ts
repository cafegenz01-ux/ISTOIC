/**
 * Authentication Utilities
 * Centralized auth logic and types
 */

export type AuthStage =
  | 'CHECKING'
  | 'WELCOME'
  | 'CREATE_ID'
  | 'SETUP_PIN'
  | 'LOCKED'
  | 'BIOMETRIC_SCAN'
  | 'LOGIN_MANUAL'
  | 'REGISTER_MANUAL'
  | 'FORGOT_PIN'
  | 'FORGOT_ACCOUNT';

export type AuthMethod = 'BIOMETRIC' | 'PIN' | 'MANUAL' | 'GOOGLE';

export interface AuthConfig {
  maxAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
  pinLength: number;
  devBypassEnabled: boolean;
}

/**
 * Default authentication configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  maxAttempts: 5,
  lockoutDuration: 5 * 60 * 1000, // 5 minutes
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  pinLength: 6,
  devBypassEnabled: (import.meta as any).env.VITE_ENABLE_DEV_BYPASS === 'true'
};

/**
 * Auth error types
 */
export enum AuthError {
  INVALID_CREDENTIALS = 'Invalid credentials',
  MAX_ATTEMPTS_EXCEEDED = 'Too many attempts. Please try again later.',
  SESSION_EXPIRED = 'Session expired. Please log in again.',
  BIOMETRIC_UNAVAILABLE = 'Biometric authentication not available',
  NETWORK_ERROR = 'Network error. Please check your connection.',
  UNKNOWN = 'An unknown error occurred'
}

/**
 * Check if stage is loading
 */
export const isLoadingStage = (stage: AuthStage): boolean => {
  return stage === 'CHECKING';
};

/**
 * Check if account is locked
 */
export const isLockedStage = (stage: AuthStage): boolean => {
  return stage === 'LOCKED';
};

/**
 * Check if user needs to set up PIN
 */
export const needsPinSetup = (stage: AuthStage): boolean => {
  return stage === 'SETUP_PIN';
};

/**
 * Check if authentication is in progress
 */
export const isAuthInProgress = (stage: AuthStage): boolean => {
  return ['LOGIN_MANUAL', 'REGISTER_MANUAL', 'BIOMETRIC_SCAN'].includes(stage);
};

/**
 * Calculate lockout time remaining
 */
export const getLockoutRemaining = (lockoutUntil: number): number => {
  return Math.max(0, lockoutUntil - Date.now());
};

/**
 * Check if currently locked out
 */
export const isLockedOut = (lockoutUntil: number): boolean => {
  return getLockoutRemaining(lockoutUntil) > 0;
};

/**
 * Format lockout error message
 */
export const formatLockoutMessage = (remainingMs: number): string => {
  if (remainingMs <= 0) return 'Account unlocked.';
  
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.ceil(remainingMs / 60000);
  
  if (seconds < 60) {
    return `Account locked. Try again in ${seconds} second${seconds > 1 ? 's' : ''}.`;
  }
  
  return `Account locked. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
};

/**
 * Validate PIN format
 */
export const isValidPin = (pin: string, length: number = 6): boolean => {
  const trimmed = pin.trim();
  return /^\d+$/.test(trimmed) && trimmed.length === length;
};

/**
 * Validate email format (RFC 5322 simplified)
 */
export const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Basic checks
  if (!emailRegex.test(trimmed)) return false;
  if (trimmed.length > 254) return false; // RFC 5321
  
  const [localPart, domain] = trimmed.split('@');
  if (localPart.length > 64) return false; // RFC 5321
  
  return true;
};

/**
 * Validate password strength
 */
export const getPasswordStrength = (password: string): 'weak' | 'fair' | 'good' | 'strong' => {
  if (password.length < 6) return 'weak';
  
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  if (score <= 1) return 'weak';
  if (score <= 2) return 'fair';
  if (score <= 3) return 'good';
  return 'strong';
};

/**
 * Check if password is strong enough
 */
export const isStrongPassword = (password: string): boolean => {
  return getPasswordStrength(password) !== 'weak';
};

/**
 * Check session validity
 */
export const isSessionValid = (lastActivityTime: number, sessionTimeoutMs: number): boolean => {
  return Date.now() - lastActivityTime < sessionTimeoutMs;
};

/**
 * Get remaining attempts
 */
export const getRemainingAttempts = (failedAttempts: number, maxAttempts: number): number => {
  return Math.max(0, maxAttempts - failedAttempts);
};

/**
 * Check if should lockout (exceed max attempts)
 */
export const shouldLockout = (failedAttempts: number, maxAttempts: number): boolean => {
  return failedAttempts >= maxAttempts;
};

/**
 * Check if in setup phase
 */
export const isInSetupPhase = (stage: AuthStage): boolean => {
  return ['CREATE_ID', 'SETUP_PIN'].includes(stage);
};
