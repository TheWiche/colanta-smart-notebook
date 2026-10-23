const { brand, accent, milk } = require('./src/theme/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: { brand, accent, milk },
      // Sombras más suaves y con tinte azul-gris que las de NativeWind (0.35 de opacidad).
      // Las claves se mantienen (sm, md, lg…) porque NativeWind las usa para calcular `elevation` en Android.
      boxShadow: {
        sm: '0px 1px 2px rgba(15, 23, 42, 0.14)',
        DEFAULT: '0px 1px 4px rgba(15, 23, 42, 0.16)',
        md: '0px 3px 8px rgba(15, 23, 42, 0.16)',
        lg: '0px 6px 14px rgba(15, 23, 42, 0.2)',
        xl: '0px 8px 20px rgba(15, 23, 42, 0.22)',
        '2xl': '0px 12px 28px rgba(15, 23, 42, 0.28)',
      },
    },
  },
  plugins: [],
};
