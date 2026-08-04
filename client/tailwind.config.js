import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tavern: {
          bg: 'transparent',
          sidebar: '#111318ee',
          card: '#1a1c24cc',
          hover: '#ffffff08',
          accent: '#7c5cbf',
          'accent-hover': '#9370db',
          text: '#d4d4d8',
          muted: '#71717a',
          border: '#ffffff12',
          user: '#2d4a7a',
          assistant: '#1a1c24aa',
          'icon-bar': '#0a0b1099',
          topbar: '#0a0b10cc',
          'right-panel': '#111318ee',
          'panel-header': '#181a22dd',
        }
      }
    },
  },
  plugins: [
    typography,
  ],
}
