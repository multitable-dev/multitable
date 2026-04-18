/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-sidebar': 'var(--bg-sidebar)',
        'bg-statusbar': 'var(--bg-statusbar)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border)',
        'accent-blue': 'var(--accent-blue)',
        'status-running': 'var(--status-running)',
        'status-idle': 'var(--status-idle)',
        'status-warning': 'var(--status-warning)',
        'status-error': 'var(--status-error)',
        'status-stopped': 'var(--status-stopped)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: ['"Menlo"', '"Consolas"', '"DejaVu Sans Mono"', '"Liberation Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
