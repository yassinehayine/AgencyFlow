/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design tokens (09-Frontend-Design.md section 10, principle 1).
      // Components use these names, never arbitrary hex or pixel values.
      colors: {
        status: {
          todo: '#64748b',
          progress: '#2563eb',
          review: '#d97706',
          done: '#16a34a',
          blocked: '#dc2626',
          cancelled: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
};
