/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        'custom-primary': '#3b82f6',
        'custom-secondary': '#10b981',
        'brand': {
          'light': '#dbeafe',
          'DEFAULT': '#2563eb',
          'dark': '#1e40af',
        },
        'accent': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#06b6d4',
          900: '#0c4a6e',
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      fontSize: {
        'custom-sm': '0.75rem',
        'custom-xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
