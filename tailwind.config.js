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
      // 使用 rem 单位的字体大小，使其可以随根字体大小缩放
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px when base is 16px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],  // 14px when base is 16px
        'base': ['1rem', { lineHeight: '1.5rem' }],     // 16px when base is 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px when base is 16px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px when base is 16px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px when base is 16px
      },
    },
  },
  plugins: [],
}
