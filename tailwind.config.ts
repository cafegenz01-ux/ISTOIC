import type { Config } from 'tailwindcss';

const withOpacity = (variable: string): any => {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue === undefined) {
      return `rgb(var(${variable}))`;
    }
    return `rgb(var(${variable}) / ${opacityValue})`;
  };
};

const config: Config = {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx,js,jsx}',
    './features/**/*.{ts,tsx,js,jsx}',
    './contexts/**/*.{ts,tsx,js,jsx}',
    './hooks/**/*.{ts,tsx,js,jsx}',
    './services/**/*.{ts,tsx,js,jsx}',
    './utils/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace'
        ],
        serif: ['"Playfair Display"', 'ui-serif', 'Georgia', '"Times New Roman"', 'serif']
      },
      colors: {
        bg: withOpacity('--bg-rgb'),
        'bg-elevated': withOpacity('--bg-elevated-rgb'),
        surface: withOpacity('--surface-rgb'),
        'surface-2': withOpacity('--surface-2-rgb'),
        border: withOpacity('--border-rgb'),
        text: withOpacity('--text-rgb'),
        'text-muted': withOpacity('--text-muted-rgb'),
        'text-invert': withOpacity('--text-invert-rgb'),
        primary: withOpacity('--primary-rgb'),
        'primary-contrast': withOpacity('--primary-contrast-rgb'),
        ring: withOpacity('--ring-rgb'),
        accent: withOpacity('--accent-rgb'),
        'accent-2': withOpacity('--accent-2-rgb'),
        danger: withOpacity('--danger-rgb'),
        warning: withOpacity('--warning-rgb'),
        success: withOpacity('--success-rgb'),
        info: withOpacity('--info-rgb'),
        focus: withOpacity('--focus-rgb'),
        // legacy aliases
        'skin-main': withOpacity('--bg-rgb'),
        'skin-card': withOpacity('--surface-rgb'),
        'skin-surface': withOpacity('--surface-rgb'),
        'skin-surface-hover': withOpacity('--surface-2-rgb'),
        'skin-border': withOpacity('--border-rgb'),
        'skin-highlight': withOpacity('--accent-rgb'),
        'skin-text': withOpacity('--text-rgb'),
        'skin-muted': withOpacity('--text-muted-rgb')
      },
      borderColor: ({ theme }: any) => ({
        ...theme('colors')
      }),
      textColor: ({ theme }: any) => ({
        ...theme('colors')
      }),
      backgroundColor: ({ theme }: any) => ({
        ...theme('colors')
      }),
      boxShadow: {
        'soft': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'md': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'lg': '0 12px 32px rgba(0, 0, 0, 0.16)',
        'xl': '0 16px 40px rgba(0, 0, 0, 0.20)',
        'glow': '0 0 24px rgba(37, 99, 235, 0.3)',
        'glow-accent': '0 0 16px rgba(37, 99, 235, 0.5)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        },
        'slideUp': {
          'from': { transform: 'translateY(10px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' }
        },
        'slideDown': {
          'from': { transform: 'translateY(-10px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' }
        },
        'slideLeft': {
          'from': { transform: 'translateX(10px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' }
        },
        'slideRight': {
          'from': { transform: 'translateX(-10px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' }
        },
        'scaleIn': {
          'from': { transform: 'scale(0.95)', opacity: '0' },
          'to': { transform: 'scale(1)', opacity: '1' }
        },
        'fadeIn': {
          'from': { opacity: '0' },
          'to': { opacity: '1' }
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' }
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-down': 'slideDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-left': 'slideLeft 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-right': 'slideRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'shimmer': 'shimmer 2s infinite',
      }
    }
  },
  plugins: []
};

export default config;
