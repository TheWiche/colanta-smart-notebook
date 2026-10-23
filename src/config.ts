/**
 * URLs de los CSV publicados en Google Sheets (Archivo > Compartir > Publicar en la Web > CSV).
 * Se leen de variables EXPO_PUBLIC_* (archivo `.env` en la raíz; ver `.env.example`).
 * Metro las incrusta al compilar y guarda este archivo en su caché: si cambias el `.env`, cambia también este texto
 * (o compila con `--reset-cache`) o el APK conservará la URL anterior. Última actualización de URLs: 2026-10-22 (catálogo con alias).
 */
export const URL_TIENDAS = process.env.EXPO_PUBLIC_URL_TIENDAS ?? '';
export const URL_PRODUCTOS = process.env.EXPO_PUBLIC_URL_PRODUCTOS ?? '';
export const URL_SUPERVISOR_WEB =
  process.env.EXPO_PUBLIC_URL_SUPERVISOR_WEB ?? 'https://thewiche.github.io/colanta-smart-notebook/';
