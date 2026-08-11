/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        gold: {
          DEFAULT: '#C9A84C',
          light: '#E8D5A3',
          dim: '#A8882A',
          dark: '#8B6914',
          subtle: 'rgba(201,168,76,0.12)',
        },
        obsidian: {
          DEFAULT: '#0A0908',
          2: '#111009',
          3: '#181612',
          4: '#1F1D17',
          5: '#272420',
        },
        stone: {
          DEFAULT: '#3A3730',
          light: '#6B6760',
        },
        cream: {
          DEFAULT: '#F5F0E8',
          dim: '#C8C0B0',
          muted: '#8A8580',
        },
        ruby: {
          DEFAULT: '#8B2635',
          light: '#C4364A',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
      },
    },
  },
  plugins: [],
}
