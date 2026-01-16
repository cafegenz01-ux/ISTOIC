import { describe, it, expect } from 'vitest';
import { sanitizeInput, hasMaliciousContent } from '../utils/securityHelper';

describe('securityHelper', () => {
  it('sanitizes basic HTML characters', () => {
    const sanitized = sanitizeInput('<script>alert(1)</script>');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });

  it('detects malicious patterns', () => {
    expect(hasMaliciousContent('<img src=x onerror=alert(1)>')).toBe(true);
    expect(hasMaliciousContent('plain text')).toBe(false);
  });
});
