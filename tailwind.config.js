/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#070c16',
          900: '#0c1424',
          850: '#111c31',
          800: '#1a2740',
          700: '#2a3a58',
          600: '#43536f',
        },
        accent: {
          DEFAULT: '#5b9bff',
          dim: '#3f7ef0',
          ink: '#081226',
        },
        muted: '#8f9bb3',
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
