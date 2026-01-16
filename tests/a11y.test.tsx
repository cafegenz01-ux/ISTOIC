import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from '../components/ui/Button';

expect.extend(toHaveNoViolations);

// Type augmentation for jest-axe
declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}

describe('Accessibility smoke tests', () => {
  it('Button component should have no detectable a11y violations', async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
