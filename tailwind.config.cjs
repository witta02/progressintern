/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Fira Sans', 'Outfit', 'Kanit', 'sans-serif'],
        mono: ['Fira Code', 'monospace']
      },
      colors: {
        brand: {
          accent: {
            DEFAULT: 'var(--color-brand-accent, #6366f1)',
            teal: 'var(--color-brand-accent-teal, #0ea5e9)',
            'teal-dim': 'var(--color-brand-accent-teal-dim, rgba(14, 165, 233, 0.1))',
            'indigo-dim': 'var(--color-brand-accent-indigo-dim, rgba(99, 102, 241, 0.1))'
          }
        }
      },
      boxShadow: {
        'glow-teal': 'var(--shadow-glow-teal, 0 0 20px rgba(14, 165, 233, 0.15))',
        'glow-indigo': 'var(--shadow-glow-indigo, 0 0 20px rgba(99, 102, 241, 0.15))',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.05)',
      }
    },
  },
  plugins: [],
}

