import { describe, it, expect } from 'vitest';
import { normalizeAuthError, isValidEmail } from '../features/auth/ManualAuth';

describe('normalizeAuthError', () => {
  it('maps invalid credential errors to friendly message', () => {
    expect(normalizeAuthError({ code: 'auth/invalid-credential' })).toContain('Email atau password salah');
  });

  it('maps weak password errors to guidance', () => {
    expect(normalizeAuthError({ code: 'auth/weak-password' })).toContain('Password terlalu lemah');
  });

  it('handles network failures', () => {
    expect(normalizeAuthError({ code: 'auth/network-request-failed' })).toContain('Koneksi bermasalah');
  });

  it('falls back to original message when unmapped', () => {
    expect(normalizeAuthError({ message: 'Custom error' })).toBe('Custom error');
  });
});

describe('isValidEmail', () => {
  it('validates basic email format', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
  });
});
