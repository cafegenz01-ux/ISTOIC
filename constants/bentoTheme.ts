/**
 * BENTO THEME SYSTEM
 * Premium color system for Bento Grid Cards
 * Optimized for iOS Web, PWA, and Capacitor
 */

export const BENTO_GRADIENTS = {
  purple: {
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #a855f7 100%)',
    solid: '#8b5cf6',
    rgb: '139 92 246',
    className: 'bento-purple'
  },
  teal: {
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 50%, #0891b2 100%)',
    solid: '#14b8a6',
    rgb: '20 184 166',
    className: 'bento-teal'
  },
  orange: {
    gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fdba74 100%)',
    solid: '#f97316',
    rgb: '249 115 22',
    className: 'bento-orange'
  },
  green: {
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
    solid: '#10b981',
    rgb: '16 185 129',
    className: 'bento-green'
  },
  red: {
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
    solid: '#ef4444',
    rgb: '239 68 68',
    className: 'bento-red'
  },
  blue: {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
    solid: '#3b82f6',
    rgb: '59 130 246',
    className: 'bento-blue'
  }
} as const;

export type BentoColor = keyof typeof BENTO_GRADIENTS;

/**
 * Bento Card Size Presets
 */
export const BENTO_SIZES = {
  small: 'col-span-12 md:col-span-6 lg:col-span-4',
  medium: 'col-span-12 md:col-span-6 lg:col-span-6',
  large: 'col-span-12 md:col-span-8 lg:col-span-8',
  xlarge: 'col-span-12 md:col-span-12 lg:col-span-12',
  hero: 'col-span-12 md:col-span-8 row-span-2'
} as const;

/**
 * Get random bento color for variety
 */
export const getRandomBentoColor = (): BentoColor => {
  const colors = Object.keys(BENTO_GRADIENTS) as BentoColor[];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Get bento color by index (for consistent assignment)
 */
export const getBentoColorByIndex = (index: number): BentoColor => {
  const colors = Object.keys(BENTO_GRADIENTS) as BentoColor[];
  return colors[index % colors.length];
};
