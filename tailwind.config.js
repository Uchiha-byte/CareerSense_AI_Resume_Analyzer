/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
        fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        },
        animation: {
            'fade-in': 'fadeIn 0.5s ease-out forwards',
            'slide-up': 'slideUp 0.4s ease-out forwards',
            'slide-in': 'slideIn 0.3s ease-out forwards',
            'pulse-slow': 'pulse 3s infinite',
        },
    },
  },
  plugins: [],
}
