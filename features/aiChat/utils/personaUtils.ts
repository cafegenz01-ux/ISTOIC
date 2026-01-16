/**
 * Persona Utility Functions
 * Centralized logic for persona-specific behaviors
 */

export type Persona = 'hanisah' | 'stoic';

export interface PersonaConfig {
  name: string;
  icon: 'Flame' | 'Brain';
  emoji: string;
  welcome: string;
  description: string;
  accentVar: string;
  traits: string[];
}

export const PERSONA_CONFIG: Record<Persona, PersonaConfig> = {
  hanisah: {
    name: 'Hanisah',
    icon: 'Flame',
    emoji: '✨',
    welcome: '**Hanisah siap membantu.**\n\nApa yang ingin kamu bahas hari ini?',
    description: 'Percakapan natural, empatik & kreatif',
    accentVar: '--accent',
    traits: ['empathic', 'creative', 'natural', 'helpful']
  },
  stoic: {
    name: 'Stoic',
    icon: 'Brain',
    emoji: '🧠',
    welcome: '**Stoic siap fokus.**\n\nBerikan konteks dan kita lanjutkan.',
    description: 'Analisis runtut, logis & objektif',
    accentVar: '--accent-2',
    traits: ['analytical', 'logical', 'objective', 'focused']
  }
};

/**
 * Get persona configuration
 */
export const getPersonaConfig = (persona: Persona): PersonaConfig => {
  return PERSONA_CONFIG[persona];
};

/**
 * Toggle persona
 */
export const togglePersona = (current: Persona): Persona => {
  return current === 'hanisah' ? 'stoic' : 'hanisah';
};

/**
 * Check if persona allows visuals
 */
export const allowsVisuals = (persona: Persona): boolean => {
  return persona === 'hanisah';
};

/**
 * Get suggestion cards for persona
 */
export const getSuggestionCards = (persona: Persona) => {
  if (persona === 'hanisah') {
    return [
      { icon: 'Sparkles', label: 'Buat Visual', desc: 'Buatkan gambar beresolusi tinggi.' },
      { icon: 'Code', label: 'Code Audit', desc: 'Debug & optimalkan algoritma.' },
      { icon: 'Wand2', label: 'Ringkas', desc: 'Sederhanakan teks kompleks.' },
      { icon: 'Brain', label: 'Brainstorm', desc: 'Kembangkan ide bersama.' }
    ];
  }
  return [
    { icon: 'Brain', label: 'First Principles', desc: 'Urai masalah kompleks dari dasar.' },
    { icon: 'Code', label: 'Code Audit', desc: 'Debug & optimalkan algoritma.' },
    { icon: 'Database', label: 'Ekstrak Data', desc: 'Parse dan analisis terstruktur.' },
    { icon: 'Zap', label: 'Optimize', desc: 'Tingkatkan efisiensi sistem.' }
  ];
};

/**
 * Validate persona
 */
export const isValidPersona = (value: unknown): value is Persona => {
  return value === 'hanisah' || value === 'stoic';
};
