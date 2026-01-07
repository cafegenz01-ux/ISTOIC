
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HANISAH_BRAIN } from '../services/melsaBrain';

// Mock localStorage for Persona checks
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('HANISAH_BRAIN Logic Core', () => {
  
  beforeEach(() => {
    localStorage.clear();
    // Default language mock
    localStorage.setItem('app_language', 'id');
  });

  // --- 1. BASIC IDENTITY CHECKS ---
  it('should generate correct System Instruction for HANISAH persona', () => {
    const prompt = HANISAH_BRAIN.getSystemInstruction('hanisah');
    expect(prompt).toContain('SYSTEM_IDENTITY: HANISAH_V25_TITANIUM');
    expect(prompt).toContain('Hyper-Intelligent Digital Partner');
  });

  it('should generate correct System Instruction for STOIC persona', () => {
    const prompt = HANISAH_BRAIN.getSystemInstruction('stoic');
    expect(prompt).toContain('SYSTEM_IDENTITY: STOIC_AURELIUS_TITANIUM');
    expect(prompt).toContain('Philosopher-King');
  });

  // --- 2. LOGIC BRANCH TESTING ---
  it('should verify Hanisah includes Singing/Performance instructions', () => {
    const prompt = HANISAH_BRAIN.getSystemInstruction('hanisah');
    // Ensure the native audio capability is instructed
    expect(prompt).toContain('SING WHEN ASKED');
    expect(prompt).toContain('Modulate your pitch, rhythm, and cadence');
    expect(prompt).toContain('Hmm~');
  });

  it('should verify Stoic strict rules (No Slang, No Images)', () => {
    const prompt = HANISAH_BRAIN.getSystemInstruction('stoic');
    expect(prompt).toContain('Dichotomy of Control');
    expect(prompt).toContain('Do not offer Image Generation unless it is strictly for diagrams');
    expect(prompt).toContain('Do not use slang/colloquialisms');
    expect(prompt).not.toContain('Sing for me'); // Stoic shouldn't sing
  });

  // --- 3. CONTEXT INJECTION TESTING ---
  it('should include user context properly when provided', () => {
    const context = "User is debugging a React application race condition.";
    const prompt = HANISAH_BRAIN.getSystemInstruction('stoic', context);
    expect(prompt).toContain('=== ACTIVE MEMORY (RAG CONTEXT) ===');
    expect(prompt).toContain(context);
    // Ensure context is placed logically in the prompt
    expect(prompt.indexOf(context)).toBeGreaterThan(prompt.indexOf('SYSTEM_IDENTITY'));
  });

  it('should handle empty context gracefully', () => {
      const prompt = HANISAH_BRAIN.getSystemInstruction('hanisah', '');
      expect(prompt).toContain('=== ACTIVE MEMORY (RAG CONTEXT) ===');
      // Should not contain undefined or null string representation
      expect(prompt).not.toContain('undefined');
      expect(prompt).not.toContain('null');
  });

  // --- 4. OVERRIDE TESTING ---
  it('should respect manual prompt overrides from localStorage', () => {
    const override = "Custom Override Prompt Logic: Be a Pirate.";
    localStorage.setItem('hanisah_system_prompt', override);
    
    const prompt = HANISAH_BRAIN.getSystemInstruction('hanisah');
    // It should contain the override
    expect(prompt).toContain(override);
    // It should STILL append the core logic (Operator Profile & Context)
    expect(prompt).toContain('=== OPERATOR PROFILE ===');
  });

  // --- 5. MECHANIC TESTING ---
  it('should generate correct Mechanic Instruction', () => {
      const mechanicPrompt = HANISAH_BRAIN.getMechanicInstruction();
      expect(mechanicPrompt).toContain('SYSTEM_MECHANIC_PRIME');
      expect(mechanicPrompt).toContain('JSON or Technical Logs only');
      expect(mechanicPrompt).toContain('Objective');
  });
});
