const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem: 16 -> `h-14` mide 56 px, como en Tailwind estándar (NativeWind usa 14 por defecto,
// lo que encogería todos los botones y textos un 12 %).
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
