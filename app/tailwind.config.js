export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7f4',
          100: '#dceee6',
          200: '#b6dacc',
          500: '#258371',
          600: '#1c7060',
          700: '#155d50',
          800: '#124c42',
        },
        secondary: { 50: '#fff9eb', 200: '#f3dda2' },
      },
      fontFamily: { display: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { elevated: '0 16px 48px #183c2810' },
    },
  },
  plugins: [],
};
