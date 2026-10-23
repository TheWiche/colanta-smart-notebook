/**
 * Paleta "Colanta Smart". Fuente única de color:
 *  - tailwind.config.js extiende el tema con `brand`, `accent` y `milk` (clases bg-brand, text-accent…).
 *  - Los íconos de Lucide y el ActivityIndicator reciben el color como prop (no como clase),
 *    así que el código los importa desde aquí. `slate` y `emerald` repiten los valores de Tailwind.
 *
 * Es CommonJS (module.exports) porque Tailwind lo carga con Node.
 */

/** Azul rey oscuro corporativo. DEFAULT = 700. */
const brand = {
  DEFAULT: '#17399B',
  50: '#EEF3FF',
  100: '#DCE6FD',
  200: '#BBCFFA',
  300: '#8FAEF5',
  400: '#5F88EC',
  500: '#3A66DD',
  600: '#244BC0',
  700: '#17399B',
  800: '#132E7C',
  900: '#0E2259',
};

/** Rojo de acento: alertas, errores y contadores. Contraste 5.9:1 sobre blanco. */
const accent = {
  DEFAULT: '#C8102E',
  50: '#FEF1F3',
  100: '#FDE1E5',
  200: '#FBC6CE',
  600: '#C8102E',
  700: '#A50D26',
};

/** Blanco lechoso para tarjetas. */
const milk = '#FDFCFA';

const slate = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
};

const emerald = {
  50: '#ECFDF5',
  200: '#A7F3D0',
  300: '#6EE7B7',
  700: '#047857',
  800: '#065F46',
};

/** Ámbar: ruta en curso. Repite los valores de Tailwind. */
const amber = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
};

module.exports = { brand, accent, milk, slate, emerald, amber, white: '#FFFFFF' };
