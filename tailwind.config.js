/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#16181d',
          900: '#1c1f26',
          850: '#21252e',
          800: '#2a2d34',
          700: '#353945',
          600: '#4a4f5e',
        },
        accent: {
          DEFAULT: '#7dd3a8',
          dim: '#5fb488',
          ink: '#0f1f17',
        },
        muted: '#9aa0ae',
      },
      borderRadius: {
        sm2: '4px',
        md2: '6px',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
