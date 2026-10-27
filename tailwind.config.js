/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--s1)',
        'surface-2': 'var(--s2)',
        'surface-3': 'var(--s3)',
        'surface-4': 'var(--s4)',
        border: 'var(--bdr)',
        'border-2': 'var(--bdr2)',
        text: 'var(--tx)',
        'text-2': 'var(--tx2)',
        'text-3': 'var(--tx3)',
        accent: 'var(--ac)',
        'accent-2': 'var(--ac2)',
        'accent-3': 'var(--ac3)',
        success: 'var(--green)',
        warning: 'var(--amber)',
        danger: 'var(--red)',
        info: 'var(--blue)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
