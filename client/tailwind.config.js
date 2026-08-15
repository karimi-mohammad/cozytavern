import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', 'tavern-dark'],
  theme: {
    extend: {
      colors: {
        tavern: {
          // Backgrounds (solid, SillyTavern-style)
          bg: 'rgb(var(--tavern-bg) / <alpha-value>)',
          surface: 'rgb(var(--tavern-surface) / <alpha-value>)',
          surface2: 'rgb(var(--tavern-surface2) / <alpha-value>)',
          input: 'rgb(var(--tavern-input) / <alpha-value>)',
          hover: 'rgb(var(--tavern-hover) / <alpha-value>)',
          // Legacy aliases (for gradual migration)
          sidebar: 'rgb(var(--tavern-sidebar) / <alpha-value>)',
          card: 'rgb(var(--tavern-card) / <alpha-value>)',
          'icon-bar': 'rgb(var(--tavern-icon-bar) / <alpha-value>)',
          topbar: 'rgb(var(--tavern-topbar) / <alpha-value>)',
          'right-panel': 'rgb(var(--tavern-right-panel) / <alpha-value>)',
          'panel-header': 'rgb(var(--tavern-panel-header) / <alpha-value>)',
          // Borders
          border: 'rgb(var(--tavern-border) / <alpha-value>)',
          'border-subtle': 'rgb(var(--tavern-border-subtle) / <alpha-value>)',
          'border-focus': 'rgb(var(--tavern-border-focus) / <alpha-value>)',
          // Text
          text: 'rgb(var(--tavern-text) / <alpha-value>)',
          'text-bright': 'rgb(var(--tavern-text-bright) / <alpha-value>)',
          muted: 'rgb(var(--tavern-muted) / <alpha-value>)',
          dim: 'rgb(var(--tavern-dim) / <alpha-value>)',
          faint: 'rgb(var(--tavern-faint) / <alpha-value>)',
          // Accents
          accent: 'rgb(var(--tavern-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--tavern-accent-hover) / <alpha-value>)',
          cta: 'rgb(var(--tavern-cta) / <alpha-value>)',
          'cta-hover': 'rgb(var(--tavern-cta-hover) / <alpha-value>)',
          dialogue: 'rgb(var(--tavern-dialogue) / <alpha-value>)',
          danger: 'rgb(var(--tavern-danger) / <alpha-value>)',
          success: 'rgb(var(--tavern-success) / <alpha-value>)',
          info: 'rgb(var(--tavern-info) / <alpha-value>)',
          // Legacy aliases
          user: 'rgb(var(--tavern-user) / <alpha-value>)',
          assistant: 'rgb(var(--tavern-assistant) / <alpha-value>)',
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
