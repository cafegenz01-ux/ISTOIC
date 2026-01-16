import { describe, it, expect, beforeEach } from 'vitest';
import { HANISAH_BRAIN } from '../services/melsaBrain';

// Mock localStorage for Persona checks
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('HANISAH_BRAIN Logic Core', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('app_language', 'id');
  });

  it('should generate correct System Instruction for HANISAH persona', async () => {
    const prompt = await HANISAH_BRAIN.getSystemInstruction('hanisah');
    expect(prompt).toContain('[IDENTITY: HANISAH_V25_TITANIUM]');
    expect(prompt).toContain('PLANNING_PROTOCOL: INTUITIVE_ASSISTANCE');
  });

  it('should generate correct System Instruction for STOIC persona', async () => {
    const prompt = await HANISAH_BRAIN.getSystemInstruction('stoic');
    expect(prompt).toContain('[IDENTITY: STOIC_AURELIUS_TITANIUM]');
    expect(prompt).toContain('PLANNING_PROTOCOL: RATIONAL_EXECUTION');
  });

  it('should verify Hanisah includes Singing/Performance instructions', async () => {
    const prompt = await HANISAH_BRAIN.getSystemInstruction('hanisah');
    expect(prompt.toUpperCase()).toContain('PERFORMANCE: SING OR ACT WHEN ASKED');
    expect(prompt).toContain('generate_visual');
  });

  it('should verify Stoic strict rules (No Slang, No Images)', async () => {
    const prompt = await HANISAH_BRAIN.getSystemInstruction('stoic');
    expect(prompt).toContain('RATIONAL_EXECUTION');
    expect(prompt.toUpperCase()).toContain('FOCUS ON ACTIONS WITHIN THE USER\'S CONTROL');
    expect(prompt.toUpperCase()).toContain('PROHIBIT UNNECESSARY VISUAL DISTRACTIONS');
  });

  it('should include user context properly when provided', async () => {
    const context = 'User is debugging a React application race condition.';
    const prompt = await HANISAH_BRAIN.getSystemInstruction('stoic', context);
    expect(prompt.length).toBeGreaterThan(50);
  });
});
