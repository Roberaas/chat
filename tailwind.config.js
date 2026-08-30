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
        // obsidian → beyaz tema karşılıkları
        obsidian: {
          DEFAULT: '#F5F3EF',
          2: '#F0EDE8',
          3: '#FFFFFF',   // bg-obsidian-3  → kart beyazı
          4: '#F0EDE8',   // bg-obsidian-4  → iç kart
          5: '#E8E5E0',
        },
        // ink → metin renkleri (beyaz temada koyu)
        ink: {
          300: 'rgba(139,105,20,0.25)',
          700: '#3A3530',
          900: '#1A1410',
        },
        stone: {
          DEFAULT: '#7A7468',  // text-stone → muted
          light: '#A8A39E',    // text-stone-light → faint
        },
        cream: {
          DEFAULT: '#1A1410',  // text-cream → koyu metin (beyaz temada)
          50:  '#1A1410',
          dim: '#3A3530',
          muted: '#7A7468',
          200: 'rgba(139,105,20,0.15)',
          300: 'rgba(139,105,20,0.25)',
        },
        moss: {
          400: '#7A9A6A',
          500: '#5A8050',
          300: '#A8C898',
        },
        ember: {
          200: 'rgba(196,54,74,0.3)',
          700: '#C4364A',
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
