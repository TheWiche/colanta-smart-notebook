const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Fija la versión de CMake del módulo `app` de Android.
 *
 * Por qué: en Windows el `ninja` de CMake 3.22.1 (el que AGP usa por defecto) no soporta rutas de más de
 * 260 caracteres, y el codegen de React Native genera objetos C++ con rutas más largas aunque el proyecto esté en
 * una carpeta corta ("ninja: error: Stat(...): Filename longer than 260 characters"). CMake 3.31 trae ninja 1.12,
 * que sí las soporta (requiere LongPathsEnabled=1 en Windows). En otros sistemas no cambia nada.
 */
module.exports = function withAndroidCmake(config, { version = '3.31.6' } = {}) {
  return withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults.contents;
    if (gradle.includes(`version "${version}"`)) return cfg;
    cfg.modResults.contents = gradle.replace(
      /^android\s*\{/m,
      `android {\n    externalNativeBuild {\n        cmake {\n            version "${version}"\n        }\n    }\n`,
    );
    return cfg;
  });
};
