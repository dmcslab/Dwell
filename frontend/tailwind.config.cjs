/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        ui:      ['"IBM Plex Sans"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
      },
      fontSize: {
        // Enforce minimum 11px for accessibility
        'xxs': ['11px', { lineHeight: '1.5' }],
      },
      colors: {
        gray: {
          50:  'rgb(var(--g50)  / <alpha-value>)',
          100: 'rgb(var(--g100) / <alpha-value>)',
          200: 'rgb(var(--g200) / <alpha-value>)',
          300: 'rgb(var(--g300) / <alpha-value>)',
          400: 'rgb(var(--g400) / <alpha-value>)',
          500: 'rgb(var(--g500) / <alpha-value>)',
          600: 'rgb(var(--g600) / <alpha-value>)',
          700: 'rgb(var(--g700) / <alpha-value>)',
          800: 'rgb(var(--g800) / <alpha-value>)',
          900: 'rgb(var(--g900) / <alpha-value>)',
          950: 'rgb(var(--g950) / <alpha-value>)',
        },
        white: 'rgb(var(--gwhite) / <alpha-value>)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        'slide-up':   'slide-up 0.25s ease-out',
        'fade-in':    'fade-in 0.2s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 0 rgb(var(--accent) / 0.3)' },
          '50%':       { boxShadow: '0 0 20px 4px rgb(var(--accent) / 0.2)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 8px 0 rgb(var(--accent) / 0.35)',
        'glow':    '0 0 16px 2px rgb(var(--accent) / 0.25)',
        'card':    '0 1px 3px rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
        'card-hover': '0 6px 20px -4px rgb(0 0 0 / 0.4)',
      },
    },
  },
  plugins: [],
}
