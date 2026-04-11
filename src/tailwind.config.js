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
        // 深色主题（默认）
        bg: 'var(--bg)',
        sidebar: 'var(--sidebar)',
        panel: 'var(--panel)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        accent: 'var(--accent)',
        accent2: 'var(--accent2)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
        success: 'var(--success)',
        error: 'var(--error)',
        warning: 'var(--warning)',
        info: 'var(--info)',
        orange: 'var(--orange)',
        hover: 'var(--hover)',
        selected: 'var(--selected)',
        'input-bg': 'var(--input-bg)',
        'header-bg': 'var(--header-bg)',
        'toolbar-bg': 'var(--toolbar-bg)',
      },
    },
  },
  plugins: [],
}
