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
          // Backgrounds (solid, SillyTavern-style)
          bg: '#0f0f1a',
          surface: '#1a1a2e',
          surface2: '#252540',
          input: '#2a2a3e',
          hover: '#2e2e4a',
          // Legacy aliases (for gradual migration)
          sidebar: '#1a1a2e',
          card: '#252540',
          'icon-bar': '#1a1a2e',
          topbar: '#1a1a2e',
          'right-panel': '#1a1a2e',
          'panel-header': '#252540',
          // Borders
          border: '#3a3a5e',
          'border-subtle': '#2a2a3e',
          'border-focus': '#6666cc',
          // Text
          text: '#ccccdd',
          'text-bright': '#e0e0ff',
          muted: '#8888aa',
          dim: '#6666aa',
          faint: '#555577',
          // Accents
          accent: '#6666cc',
          'accent-hover': '#7777dd',
          cta: '#ff6644',
          'cta-hover': '#ff7755',
          dialogue: '#ffaa44',
          danger: '#ff4444',
          success: '#44cc66',
          info: '#4488cc',
          // Legacy aliases
          user: '#ccccdd',
          assistant: '#1a1a2e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [
    typography,
  ],
}
