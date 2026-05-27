/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['18px', '1.6'],
        lg: ['20px', '1.55'],
        xl: ['22px', '1.5'],
        '2xl': ['26px', '1.4'],
        '3xl': ['32px', '1.3'],
        '4xl': ['40px', '1.2'],
      },
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#1E3A8A',
        },
        cta: {
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
        },
        sidebar: {
          bg: '#0F172A',
          hover: '#1E293B',
          text: '#94A3B8',
          label: '#64748B',
        },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
