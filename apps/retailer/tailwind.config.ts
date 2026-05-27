import type { Config } from 'tailwindcss';
import finmemoryUiPreset from '../../packages/ui-components/tailwind-preset';

export default {
  darkMode: ['class'],
  presets: [finmemoryUiPreset],
  content: [
    './pages/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}',
    './lib/**/*.{ts,tsx,js,jsx}',
    '../../packages/ui-components/src/**/*.{ts,tsx}',
  ],
  safelist: [
    'bg-[#0a0f1a]',
    'bg-[#141c2e]',
    'bg-[#f8fafc]',
    'text-[#0f172a]',
    'text-[#2ECC49]',
    'text-[#475569]',
    'text-white/80',
    'text-white/75',
    'text-white/82',
    'border-white/10',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        community: {
          DEFAULT: 'hsl(var(--community))',
          foreground: 'hsl(var(--community-foreground))',
        },
      },
      boxShadow: {
        'card-lovable': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'card-dark': '0 4px 6px rgba(0, 0, 0, 0.3)',
        'card-light': '0 2px 8px rgba(0, 0, 0, 0.1)',
        fab: '0 4px 12px rgba(46, 204, 73, 0.4)',
      },
      borderRadius: {
        '3xl': '1.5rem',
      },
      keyframes: {
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'onboarding-hand-bounce': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-12px) scale(1.05)' },
        },
        'onboarding-gps-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201, 162, 39, 0.55)' },
          '50%': { boxShadow: '0 0 0 12px rgba(201, 162, 39, 0)' },
        },
      },
      animation: {
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'onboarding-hand-bounce': 'onboarding-hand-bounce 1.15s ease-in-out infinite',
        'onboarding-gps-pulse': 'onboarding-gps-pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
