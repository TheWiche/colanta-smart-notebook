import type { Store } from '../types';
import { displayCodigo } from './manualStore';
import { cantidadDe, MEDIDA, medidasDeTexto, separarMedidas } from './medidas';
import { normalize } from './normalize';

/*
 * Búsqueda palabra por palabra, para productos y tiendas.
 *
 * "leche 900" no busca ese texto pegado: busca "leche" y "900" por separado, en cualquier orden y en cualquier
 * campo (nombre, referencia, subcategoría, categoría). Primero sale lo que tiene más palabras; a igual cantidad, lo
 * que las encuentra mejor (palabra completa, en un campo fuerte); a igual puntaje, el orden original de la lista.
 *
 * Cada palabra se busca así, de la coincidencia más a la menos exacta:
 *  1. Completa, o como comienzo de una palabra ("lech" en "LECHES"), o al final de una palabra compuesta
 *     ("crema" en "DOBLECREMA", "kid" en "YOGURKID"). También pegada o separada: "doblecrema" = "DOBLE CREMA".
 *  2. Abreviatura o variante: "deslactosada" en "DESLAC", "chocolate" en "CHOC", "bolsa" en "BOL", "entero" en
 *     "ENTERA". Los nombres del ERP vienen abreviados y la palabra completa casi nunca está en ellos.
 *  3. Parecida (solo si la palabra no está dentro de ninguna palabra del catálogo): "lehce", "mantequila", "yogru".
 * Los números se buscan completos ("900" no está en "1900") y las medidas por su valor ("1 litro" = "X1000ML").
 */

/** Peso de un campo. A igual cantidad de palabras encontradas, gana lo que las tiene en campos más fuertes. */
export const WEIGHT = { strong: 3, medium: 2, weak: 1 } as const;

// Qué tan bien coincide una palabra con un campo. El puntaje es peso del campo x calidad.
const CALIDAD = {
  entera: 20, // la palabra es una palabra del campo: "leche" en "LECHE UHT"
  prefijo: 18, // el campo la tiene como comienzo de una palabra: "lech" en "LECHES"
  alterna: 16, // abreviatura, variante o género: "deslactosada" en "DESLAC", "entero" en "ENTERA"
  interna: 14, // al final de una palabra compuesta: "crema" en "DOBLECREMA"
  parecida: 10, // le falta o le sobra una letra: "lehce" por "leche"
  codigoParcial: 8, // un número a medio escribir contra un código: "58" en "5812"
} as const;

export interface SearchField {
  /** Texto tal como viene; se normaliza una sola vez, al armar el índice. */
  text: string;
  weight: number;
  /**
   * Código o referencia. Si la búsqueda es un solo número, aquí también vale escrito a medias ("58" encuentra la
   * referencia 5812) para ver resultados mientras se teclea; esas coincidencias pesan muy poco.
   */
  codigo?: boolean;
  /** El campo trae medidas ("X900ML", "1 L"): se indexan por su valor para encontrarlas como "900 ml" o "1 litro". */
  medidas?: boolean;
}

interface IndexedField {
  text: string;
  weight: number;
  codigo: boolean;
  /** Palabras del texto (solo letras), para saber si una palabra coincide completa, como prefijo o como abreviatura. */
  palabras: string[];
  /** Cada par de palabras seguidas, pegado ("DOBLE CREMA" -> "doblecrema", "L. UHT" -> "luht"). */
  unidas: string[];
}

export interface SearchIndex<T> {
  items: readonly T[];
  /** Campos de cada item (en paralelo con `items`), ya normalizados y del más fuerte al más débil. */
  fields: readonly (readonly IndexedField[])[];
  /** Llaves de medida de cada item (en paralelo con `items`); vacío si no trae ninguna. */
  medidas: readonly (readonly string[])[];
  /** Palabras distintas de todo el índice: de ahí salen las abreviaturas y las parecidas. */
  vocabulario: ReadonlySet<string>;
  /**
   * Palabras completas: las que aparecen en un campo que no es el principal del item (categoría, subcategoría).
   * "agua" o "yogur" lo son, "desc" o "choc" no: una palabra completa nunca es la abreviatura de otra.
   */
  reales: ReadonlySet<string>;
  /** Algún campo trae medidas: solo entonces "litro" o "kilo" se leen como medida (en una tienda son parte del nombre). */
  usaMedidas: boolean;
  /** Memoria: palabra buscada -> palabras del índice que la sustituyen y su calidad. Se llena sola al buscar. */
  alternas: Map<string, Map<string, number>>;
  parecidas: Map<string, Map<string, number>>;
}

export interface SearchResult<T> {
  /** Palabras efectivas de la búsqueda (ver `tokenize`). Vacío = no hay búsqueda y `todas` trae la lista entera. */
  palabras: string[];
  /** Tienen todas las palabras, de la más a la menos relevante. */
  todas: T[];
  /** Tienen solo algunas (con una sola palabra nunca hay). Primero las que tienen más. */
  algunas: T[];
}

// Conectores y relleno: "leche de 900" busca lo mismo que "leche 900". Las letras sueltas ("y", "a", la "x"
// de "x 900") se descartan aparte.
// "sabor fresa" busca fresa; "ref 4132" y "codigo 4132" buscan 4132 (así los muestra la pantalla).
const STOPWORDS = new Set([
  'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'un', 'una',
  'sabor', 'sabores', 'ref', 'referencia', 'cod', 'codigo', 'sku',
]);

// Una búsqueda más larga que esto no es un nombre de producto: se recorta para que pegar un texto enorme no trabe la app.
const MAX_CONSULTA = 100;
const MAX_PALABRAS = 10;

/** Sinónimos que usa la gente y el catálogo escribe distinto. */
const SINONIMOS: Record<string, readonly string[]> = {
  sandwich: ['sanduche'],
  sanduche: ['sandwich'],
  durazno: ['melocoton'],
  melocoton: ['durazno'],
  cocktail: ['coctel'],
  coctel: ['cocktail'],
};
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
// "yogurt", como se escribe mucho en Colombia, es "YOGUR" en el catálogo.
const YOGURT = /^yogh?urth?s?$/;

/**
 * Abreviaturas del ERP que no se pueden deducir de la palabra completa: tienen menos de 4 letras (las de 4 o más se
 * detectan solas, ver `alternativas`) o no son su comienzo ("BTLL", "VLLA", "GFA"). Se busca por el comienzo de la
 * palabra tecleada, así "tajado", "tajada" y "tajadas" comparten "TAJ".
 */
const ABREVIATURAS: readonly (readonly [string, readonly string[]])[] = [
  ['bolsa', ['bol']],
  ['tajad', ['taj']],
  ['colanta', ['col']],
  ['paquet', ['paq', 'pq', 'pqte']],
  ['botell', ['bot', 'btl', 'btll', 'btlla']],
  ['surtid', ['sur']],
  ['garraf', ['gfa']],
  ['vainill', ['vlla']],
  ['unidad', ['u', 'und', 'uds']],
  ['gramo', ['g', 'gr', 'grs']],
  ['yogur', ['yog']],
  // L.UHT, L.PAST y LPOLVO son leche UHT, pasteurizada y en polvo: sin categorías, es lo único que dice "leche" ahí
  ['leche', ['luht', 'lpast', 'lpolvo']],
];

const ZERO = 48; // '0'
const isDigit = (code: number) => code >= ZERO && code <= ZERO + 9;

/**
 * Plural -> singular: "quesos" -> "queso", "yogures" -> "yogur", "leches" -> "lech". Basta con la raíz porque
 * se busca como subcadena ("lech" encuentra "leche"); el singular ya encuentra el plural por sí solo.
 */
function singular(word: string): string {
  const n = word.length;
  if (n < 4 || word[n - 1] !== 's' || !VOWELS.has(word[n - 2])) return word;
  // Consonante + "es" (yogures, jamones, leches): se quita "es" si queda una raíz de 3 letras ("tres" no cambia).
  if (word[n - 2] === 'e' && !VOWELS.has(word[n - 3])) return n >= 5 ? word.slice(0, -2) : word;
  // Vocal + "s" (quesos, fresas).
  return word.slice(0, -1);
}

/**
 * Siglas con punto ("L.UHT") se escriben pegadas ("LUHT"), tanto en el índice como en lo que se teclea, para que se
 * encuentren de las dos formas.
 */
const compactar = (texto: string) => texto.replace(/\b([a-z])\.(?=[a-z])/g, '$1');

/**
 * Palabras efectivas de una búsqueda, sin tildes ni mayúsculas, en el orden escrito y sin repetir:
 *  - corta en espacios y signos, y separa los números de las letras: "x6u" -> "6";
 *  - descarta conectores y letras sueltas, pero no los dígitos ("6" sirve para "x6u");
 *  - pasa los plurales a singular ("leches" encuentra "leche") y "yogurt" a "yogur";
 *  - junta cada medida en una sola palabra: "1 litro", "1000ml" y "1l" son la misma ("#v1000").
 */
export function tokenize(query: string, conMedidas = true): string[] {
  // El "#" se quita: es la marca de las medidas y no debe poder venir de lo que se teclea.
  const base = compactar(normalize(query.slice(0, MAX_CONSULTA)).replace(/#/g, ' ').replace(/½/g, ' 1/2 '));
  const { texto, medidas } = conMedidas ? separarMedidas(base) : { texto: base, medidas: [] as string[] };
  const palabras: string[] = [];
  for (const word of texto.match(/#\d+|[a-z]+|[0-9]+/g) ?? []) {
    if (palabras.length >= MAX_PALABRAS) break;
    let palabra: string;
    if (word[0] === MEDIDA) {
      palabra = medidas[Number(word.slice(1))];
    } else {
      if (STOPWORDS.has(word) || (word.length === 1 && !isDigit(word.charCodeAt(0)))) continue;
      palabra = YOGURT.test(word) ? 'yogur' : singular(word);
    }
    if (!palabras.includes(palabra)) palabras.push(palabra);
  }
  return palabras;
}

/** Normaliza los campos de cada item una sola vez: la búsqueda corre en cada tecla. */
export function buildIndex<T>(items: readonly T[], fieldsOf: (item: T) => SearchField[]): SearchIndex<T> {
  const vocabulario = new Set<string>();
  const reales = new Set<string>();
  const medidas: string[][] = [];

  const fields = items.map((item) => {
    const medidasItem: string[] = [];
    const campos = fieldsOf(item)
      .filter((field) => field.text.trim() !== '')
      .map((field): IndexedField => {
        const original = compactar(normalize(field.text));
        // "1.125 G" se busca como "1125": el punto de miles no cuenta. Las medidas se leen antes, con su punto.
        const text = original.replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2');
        const palabras = text.match(/[a-z]+/g) ?? [];
        for (const palabra of palabras) vocabulario.add(palabra);
        if (field.medidas) {
          for (const medida of medidasDeTexto(original)) if (!medidasItem.includes(medida)) medidasItem.push(medida);
        }
        // Solo espacios y signos entre las dos palabras: un número en medio las separa de verdad.
        const unidas = [...text.matchAll(/([a-z]+)[ .\-/_]+(?=([a-z]+))/g)].map((par) => par[1] + par[2]);
        return { text, weight: field.weight, codigo: field.codigo === true, palabras, unidas };
      })
      .sort((a, b) => b.weight - a.weight);
    medidas.push(medidasItem);
    const principal = campos.length > 0 ? campos[0].weight : 0;
    for (const campo of campos) if (campo.weight < principal) for (const palabra of campo.palabras) reales.add(palabra);
    return campos;
  });

  const usaMedidas = medidas.some((m) => m.length > 0);
  return { items, fields, medidas, vocabulario, reales, usaMedidas, alternas: new Map(), parecidas: new Map() };
}

// --- Cómo se busca cada palabra ---------------------------------------------------------------------

type Termino =
  | {
      tipo: 'palabra';
      palabra: string;
      alternas: ReadonlyMap<string, number>;
      vocabulario: ReadonlySet<string>;
      /** Las otras palabras de la búsqueda. */
      vecinas: readonly string[];
    }
  | { tipo: 'numero'; palabra: string; parcial: boolean }
  | { tipo: 'medida'; llave: string; valor: string };

/** Palabras del índice que valen por `palabra`: abreviaturas de 4 o más letras, las de la tabla y el otro género. */
function alternativas<T>(index: SearchIndex<T>, palabra: string): Map<string, number> {
  const memoria = index.alternas.get(palabra);
  if (memoria) return memoria;

  const alternas = new Map<string, number>();
  // "entero" por "ENTERA", "descremado" por "DESCREMADA", "lacteo" por "LACTEAS" (el plural lo trae `startsWith`)
  const otroGenero =
    palabra.length >= 5 && (palabra.endsWith('o') || palabra.endsWith('a'))
      ? palabra.slice(0, -1) + (palabra.endsWith('o') ? 'a' : 'o')
      : null;
  for (const candidata of index.vocabulario) {
    if (otroGenero !== null && candidata.startsWith(otroGenero)) alternas.set(candidata, CALIDAD.alterna);
    // "desc" por "descremada", "choc" por "chocolate". Con 3 letras o menos habría falsos amigos ("sal" por
    // "salchicha", "pet" por "petito"), por eso esas van en la tabla. Y una palabra completa del catálogo no es la
    // abreviatura de otra: "aguacate" no es "agua" ni "lechera" es "leche".
    if (
      candidata.length >= 4 &&
      palabra.length > candidata.length &&
      palabra.startsWith(candidata) &&
      !STOPWORDS.has(candidata) &&
      !index.reales.has(candidata)
    ) {
      alternas.set(candidata, CALIDAD.alterna);
    }
    // Una palabra larga con una letra de más, de menos o cambiada: el ERP también se equivoca ("MOZARELLA",
    // "ESTADAR") y quien teclea la palabra bien no la encontraría. Con palabras cortas "queso" traería "hueso".
    if (palabra.length >= 7 && !alternas.has(candidata) && distancia(candidata, palabra, 1) <= 1) {
      alternas.set(candidata, CALIDAD.parecida);
    }
  }
  for (const palabraAlterna of abreviaturasDe(index, palabra)) alternas.set(palabraAlterna, CALIDAD.alterna);
  for (const sinonimo of SINONIMOS[palabra] ?? []) if (index.vocabulario.has(sinonimo)) alternas.set(sinonimo, CALIDAD.alterna);
  index.alternas.set(palabra, alternas);
  return alternas;
}

/**
 * Palabras del índice que son abreviatura de `palabra` o, al revés, su palabra completa: de "tajado" a "taj" y de
 * "gfa" a "garrafa" (y a sus hermanas, "btll" y "btlla" son la misma). Solo las que existen en el índice.
 */
function abreviaturasDe<T>(index: SearchIndex<T>, palabra: string): string[] {
  const salida: string[] = [];
  for (const [raiz, abreviaturas] of ABREVIATURAS) {
    // La raíz con a lo sumo dos letras más (género, plural): "tajada" sí, "yogurkid" no es "yogur".
    if (palabra.startsWith(raiz) && palabra.length <= raiz.length + 2) {
      for (const abreviatura of abreviaturas) if (index.vocabulario.has(abreviatura)) salida.push(abreviatura);
    } else if (abreviaturas.includes(palabra)) {
      for (const candidata of index.vocabulario) if (candidata.startsWith(raiz) || abreviaturas.includes(candidata)) salida.push(candidata);
    }
  }
  return salida;
}

/** Cuántas letras puede estar mal una palabra para darla por tecleada con error. */
const toleranciaDe = (palabra: string) => (palabra.length < 4 ? 0 : palabra.length < 7 ? 1 : 2);

/**
 * Distancia entre dos palabras: insertar, borrar, cambiar una letra o intercambiar dos vecinas ("lehce") cuenta 1.
 * Si el largo ya difiere en más de `limite` devuelve `limite + 1` sin calcular.
 */
function distancia(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  let anterior2: number[] = [];
  let anterior: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      let valor = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) valor = Math.min(valor, anterior2[j - 2] + 1);
      actual[j] = valor;
    }
    anterior2 = anterior;
    anterior = actual;
  }
  return anterior[b.length];
}

/**
 * Palabras del índice a una o dos letras de distancia de `palabra`, o de su comienzo: igual que la búsqueda exacta,
 * "lehce" vale por "leche" y por "leches". Solo se piden cuando la palabra no apareció en ningún lado.
 */
function parecidas<T>(index: SearchIndex<T>, palabra: string): Map<string, number> {
  const memoria = index.parecidas.get(palabra);
  if (memoria) return memoria;

  const parecidas = new Map<string, number>();
  // `tokenize` le quitó la "s" final a lo que parecía un plural ("citrus" -> "citru", "kuis" -> "kui"): con un error de
  // tecleo eso suma una letra de diferencia, así que también se prueba con la "s" (y la "es") devuelta. Cada forma
  // tiene su propia tolerancia, según su largo.
  // La "s" se prueba desde 3 letras ("kuis" llega como "kui"); la "es" solo desde 4: con 3 letras se parecería a todo.
  const formas = [palabra, ...(palabra.length >= 3 ? [`${palabra}s`] : []), ...(palabra.length >= 4 ? [`${palabra}es`] : [])]
    .map((forma) => ({ forma, limite: toleranciaDe(forma) }))
    .filter(({ limite }) => limite > 0);
  if (formas.length > 0) {
    for (const candidata of index.vocabulario) {
      if (candidata.length < 3 || STOPWORDS.has(candidata)) continue;
      const parecida = formas.some(
        ({ forma, limite }) =>
          distancia(candidata, forma, limite) <= limite ||
          // comparar con el comienzo ("lehce" con "leche" de "leches") solo en palabras de 6 o más letras
          (forma.length >= 6 &&
            candidata.length > forma.length &&
            distancia(candidata.slice(0, forma.length), forma, limite) <= limite),
      );
      if (parecida) parecidas.set(candidata, CALIDAD.parecida);
    }
    // Lo corregido también puede venir abreviado: "vainila" -> "vainilla" -> "VLLA"
    for (const candidata of [...parecidas.keys()]) {
      for (const abreviatura of abreviaturasDe(index, candidata)) {
        if (!parecidas.has(abreviatura)) parecidas.set(abreviatura, CALIDAD.parecida);
      }
    }
  }
  index.parecidas.set(palabra, parecidas);
  return parecidas;
}

/** `true` si alguna palabra del índice coincide con `palabra`: o sea, si buscarla tal cual puede encontrar algo. */
function existe<T>(index: SearchIndex<T>, palabra: string, vecinas: readonly string[]): boolean {
  for (const candidata of index.vocabulario) {
    if (calidadEnPalabra(candidata, palabra, index.vocabulario, vecinas) > 0) return true;
  }
  return false;
}

/** `true` si `numero` está completo en `text`. "900" está en "x900ml" y "900 g", pero no en "1900ml" ni "9000". */
function contieneNumero(text: string, numero: string, parcial: boolean): boolean {
  for (let at = text.indexOf(numero); at !== -1; at = text.indexOf(numero, at + 1)) {
    const end = at + numero.length;
    // Sigue el número ("9000"). Con `parcial` basta con que empiece así: "58" está en "5812".
    if (!parcial && end < text.length && isDigit(text.charCodeAt(end))) continue;
    let before = at - 1;
    while (before >= 0 && text.charCodeAt(before) === ZERO) before--;
    // Los ceros a la izquierda no cuentan ("101" está en "RIO-0101"), pero otro dígito antes sí ("1900").
    if (before < 0 || !isDigit(text.charCodeAt(before))) return true;
  }
  return false;
}

/**
 * Calidad (0 si no coincide) con que `palabra` coincide con una palabra del texto.
 * Empezar igual vale ("lech" en "LECHES"). Estar dentro, solo si la palabra es larga o si el texto es una palabra
 * compuesta que termina en ella: lo que antecede es otra palabra del índice o una sola letra ("crema" en
 * "DOBLECREMA", "kid" en "YOGURKID", "uht" en "LUHT"). En los demás casos una palabra corta es un falso amigo:
 * "res" en "FRESA", en "POSTRES" o en "COLORES"; "crema" en "SEMIDESCREMADA".
 */
function calidadEnPalabra(
  candidata: string,
  palabra: string,
  vocabulario: ReadonlySet<string>,
  vecinas: readonly string[],
): number {
  if (candidata === palabra) return CALIDAD.entera;
  if (candidata.startsWith(palabra)) return CALIDAD.prefijo;
  if (candidata.endsWith(palabra)) {
    // Lo que antecede puede ser una palabra del catálogo o la otra palabra tecleada: "super boom" por "SUPERBOOM"
    const resto = candidata.slice(0, candidata.length - palabra.length);
    if (resto.length === 1 || vocabulario.has(resto) || vecinas.includes(resto)) return CALIDAD.interna;
  }
  if (palabra.length >= 6 && candidata.includes(palabra)) return CALIDAD.interna;
  return 0;
}

/** Calidad (0 si no coincide) con que `palabra` aparece en un campo. */
function calidadPalabra(campo: IndexedField, termino: Extract<Termino, { tipo: 'palabra' }>): number {
  const { palabra, alternas, vocabulario, vecinas } = termino;
  // "doblecrema" y "luht" valen por "DOBLE CREMA" y "L. UHT": se escriben pegadas o separadas según quién las teclee.
  if (campo.unidas.includes(palabra)) return CALIDAD.entera;
  let mejor = 0;
  for (const candidata of campo.palabras) {
    const calidad = calidadEnPalabra(candidata, palabra, vocabulario, vecinas);
    if (calidad === CALIDAD.entera) return calidad;
    mejor = Math.max(mejor, calidad, alternas.size > 0 ? (alternas.get(candidata) ?? 0) : 0);
  }
  return mejor;
}

/** Puntaje (0 si no coincide) de un término contra un item: lo mejor que logra en alguno de sus campos. */
function puntaje<T>(index: SearchIndex<T>, i: number, termino: Termino): number {
  const campos = index.fields[i];
  let mejor = 0;

  if (termino.tipo === 'medida') {
    if (index.medidas[i].includes(termino.llave)) return WEIGHT.strong * CALIDAD.entera;
    // Un item sin ninguna medida escrita ("... BOLSA 900X6U") se busca por el número, como si se hubiera tecleado solo.
    if (index.medidas[i].length > 0) return 0;
    for (const campo of campos) {
      if (campo.weight * CALIDAD.interna > mejor && contieneNumero(campo.text, termino.valor, false)) {
        mejor = campo.weight * CALIDAD.interna;
      }
    }
    return mejor;
  }

  // Lo mejor que logra en un campo, más un poco por cada otro campo donde también aparece: una palabra que está en el
  // nombre y en la subcategoría dice más que una que solo está en uno.
  let camposConAcierto = 0;
  for (const campo of campos) {
    let calidad = 0;
    if (termino.tipo === 'numero') {
      if (contieneNumero(campo.text, termino.palabra, false)) calidad = CALIDAD.entera;
      else if (termino.parcial && campo.codigo && contieneNumero(campo.text, termino.palabra, true)) {
        calidad = CALIDAD.codigoParcial;
      }
    } else {
      calidad = calidadPalabra(campo, termino);
    }
    if (calidad > 0) {
      camposConAcierto++;
      mejor = Math.max(mejor, campo.weight * calidad);
    }
  }
  return camposConAcierto > 1 ? mejor + BONO_CAMPO * (camposConAcierto - 1) : mejor;
}

/** Puntos extra por cada campo adicional donde aparece la palabra. */
const BONO_CAMPO = 4;
/** Puntos extra al item cuyo nombre trae las palabras de la búsqueda seguidas y en el mismo orden ("queso crema"). */
const BONO_FRASE = 6;

function compilar<T>(index: SearchIndex<T>, palabra: string, parcial: boolean, vecinas: readonly string[]): Termino {
  if (palabra[0] === MEDIDA) return { tipo: 'medida', llave: palabra, valor: cantidadDe(palabra) };
  if (isDigit(palabra.charCodeAt(0))) return { tipo: 'numero', palabra, parcial };
  return {
    tipo: 'palabra',
    palabra,
    alternas: alternativas(index, palabra),
    vocabulario: index.vocabulario,
    vecinas: vecinas.filter((otra) => otra !== palabra),
  };
}

/** Busca palabra por palabra y separa lo que tiene todas las palabras de lo que tiene solo algunas. */
export function search<T>(index: SearchIndex<T>, query: string): SearchResult<T> {
  const palabras = tokenize(query, index.usaMedidas);
  if (palabras.length === 0) return { palabras, todas: [...index.items], algunas: [] };

  const total = index.items.length;
  const n = palabras.length;
  // Un número que es toda la búsqueda puede ser un código a medio escribir. Con más palabras ("leche 900") es una
  // medida: va completo. "x6" tampoco es un código: trae letras.
  const soloNumero = n === 1 && /^\s*\d+\s*$/.test(query);
  const terminos = palabras.map((palabra) => compilar(index, palabra, soloNumero, palabras));

  // puntajes[i * n + j]: lo que logra la palabra j en el item i.
  const puntajes = new Uint16Array(total * n);
  for (let i = 0; i < total; i++) {
    for (let j = 0; j < n; j++) puntajes[i * n + j] = puntaje(index, i, terminos[j]);
  }

  // Rescate: una palabra que no está dentro de ninguna palabra del catálogo seguramente trae un error de tecleo.
  // Solo entonces se buscan las parecidas; si no, "queso" traería "hueso" y "polvo" traería "pollo".
  for (let j = 0; j < n; j++) {
    const termino = terminos[j];
    if (termino.tipo !== 'palabra' || existe(index, termino.palabra, termino.vecinas)) continue;
    const cercanas = parecidas(index, termino.palabra);
    if (cercanas.size === 0) continue;
    for (let i = 0; i < total; i++) {
      for (const campo of index.fields[i]) {
        // Se suma a lo que ya hubiera (una abreviatura, por ejemplo): se queda con lo mejor.
        if (campo.weight * CALIDAD.parecida <= puntajes[i * n + j]) break;
        if (campo.palabras.some((candidata) => cercanas.has(candidata))) {
          puntajes[i * n + j] = campo.weight * CALIDAD.parecida;
          break;
        }
      }
    }
  }

  // Las palabras de la búsqueda, seguidas y en orden ("queso crema"), como frase.
  const soloPalabras = terminos.filter((t) => t.tipo === 'palabra').map((t) => (t as { palabra: string }).palabra);
  const frase = soloPalabras.length >= 2 ? soloPalabras.join(' ') : '';

  const hits: { position: number; matched: number; score: number }[] = [];
  for (let i = 0; i < total; i++) {
    let matched = 0;
    let score = 0;
    for (let j = 0; j < n; j++) {
      const valor = puntajes[i * n + j];
      if (valor > 0) {
        matched++;
        score += valor;
      }
    }
    if (matched === 0) continue;
    if (frase && index.fields[i].some((campo) => campo.text.includes(frase))) score += BONO_FRASE;
    hits.push({ position: i, matched, score });
  }

  hits.sort((a, b) => b.matched - a.matched || b.score - a.score || a.position - b.position);
  const todas: T[] = [];
  const algunas: T[] = [];
  for (const hit of hits) (hit.matched === n ? todas : algunas).push(index.items[hit.position]);
  return { palabras, todas, algunas };
}

/** Tiendas por nombre y por el código que ve el usuario (las nuevas salen como "SIN CÓDIGO"). */
export const buildStoreIndex = (tiendas: readonly Store[]): SearchIndex<Store> =>
  buildIndex(tiendas, (t) => [
    { text: t.nombre, weight: WEIGHT.strong },
    // El nombre secundario pesa casi igual: es como la conocen en la calle
    { text: t.alias ?? '', weight: WEIGHT.strong },
    { text: displayCodigo(t), weight: WEIGHT.strong, codigo: true },
  ]);
