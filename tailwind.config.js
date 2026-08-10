/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        cream: {
          50: '#fdfcf7',
          100: '#faf6ec',
          200: '#f3ead1',
          300: '#e8d9a8',
          400: '#d9c07a',
          500: '#c4a154',
        },
        moss: {
          50: '#f4f6f1',
          100: '#e6ebd9',
          200: '#cfd9b4',
          300: '#a8b885',
          400: '#7c9059',
          500: '#5a7041',
          600: '#3f5230',
          700: '#293821',
          800: '#1a2415',
        },
        ink: {
          50: '#f7f6f4',
          100: '#e8e6e0',
          200: '#c8c4b7',
          300: '#928c79',
          500: '#3d3a30',
          700: '#22201a',
          900: '#0f0e0a',
        },
        ember: {
          400: '#d97757',
          500: '#c4633f',
          600: '#a64d2e',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
