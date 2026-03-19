/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'monospace'],
        ui:      ['Exo 2', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Full gray scale driven by CSS variables — enables dark/light toggle
        // without touching component code
        gray: {
          50:  'rgb(var(--g50) / <alpha-value>)',
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
        // white also driven by variable (dark text in light mode)
        white: 'rgb(var(--gwhite) / <alpha-value>)',
      },
      animation: {
        'scanline':    'scanline 8s linear infinite',
        'pulse-slow':  'pulse 3s ease-in-out infinite',
        'flicker':     'flicker 4s linear infinite',
        'glow-pulse':  'glow-pulse 2s ease-in-out infinite',
        'slide-up':    'slide-up 0.3s ease-out',
        'slide-in':    'slide-in 0.2s ease-out',
      },
      keyframes: {
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%, 95%, 100%': { opacity: '1' },
          '96%':            { opacity: '0.92' },
          '97%':            { opacity: '1' },
          '98%':            { opacity: '0.95' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 0 rgb(var(--accent-glow))' },
          '50%':       { boxShadow: '0 0 20px 4px rgb(var(--accent-glow))' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-in': {
          '0%':   { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 8px 0 rgb(var(--accent-glow) / 0.4)',
        'glow':    '0 0 16px 2px rgb(var(--accent-glow) / 0.3)',
        'glow-lg': '0 0 32px 8px rgb(var(--accent-glow) / 0.2)',
        'card':    '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
        'card-hover': '0 8px 24px -4px rgb(0 0 0 / 0.5), 0 0 0 1px rgb(var(--g700) / 0.5)',
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgb(var(--g800) / 0.3) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--g800) / 0.3) 1px, transparent 1px)",
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
