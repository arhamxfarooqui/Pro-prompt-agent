/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,tsx,ts,jsx,js}',
    './components/**/*.{tsx,ts,jsx,js}',
    './lib/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {
      colors: {
        'app-bg': '#0F172A',
        'background': '#0F172A',
        'surface': '#1E293B',
        'surface-hover': '#263044',
        'surface-elevated': 'rgba(30, 41, 59, 0.8)',
        'border-default': '#334155',
        'primary': '#2563EB',
        'primary-hover': '#1D4ED8',
        'primary-light': '#3B82F6',
        'primary-glow': 'rgba(37, 99, 235, 0.2)',
        'primary-text': '#60A5FA',
        'accent-yellow': '#FBBF24',
        'accent-yellow-bg': 'rgba(251, 191, 36, 0.15)',
        'accent-red': '#EF4444',
        'accent-red-bg': 'rgba(239, 68, 68, 0.15)',
        'accent-green': '#10B981',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'h1': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'h2': ['18px', { lineHeight: '28px', fontWeight: '500' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'small': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      borderRadius: { 'btn': '6px', 'modal': '12px' },
      boxShadow: {
        'modal': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        'glow-blue': '0 0 0 2px rgba(37, 99, 235, 0.3)',
        'glow-sm': '0 0 12px rgba(37, 99, 235, 0.15)',
      },
      transitionDuration: { 'ui': '150ms' },
      transitionTimingFunction: { 'ui': 'ease-in-out' },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-in-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(37, 99, 235, 0)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
