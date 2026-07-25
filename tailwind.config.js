/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#141812',
        paper: '#F4F0E6',
        oat: '#E6DECC',
        signal: '#FF5A36',
        leaf: '#315A43',
        mist: '#BEC7B6',
      },
      fontFamily: {
        display: ['CormorantGaramond_600SemiBold'],
        sans: ['Manrope_400Regular'],
        medium: ['Manrope_600SemiBold'],
      },
    },
  },
  plugins: [],
};
