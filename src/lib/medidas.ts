/*
 * Medidas de los productos y de las búsquedas.
 *
 * Los nombres del ERP escriben la misma medida de varias formas ("X1L", "X1000ML", "1000 ML", "1 L") y quien busca
 * dice "1 litro", "medio litro", "1/2 kg" o "500 gr". Para que se encuentren, todas se pasan a una llave común: la
 * dimensión (`v` volumen en ml, `m` masa en g) y la cantidad en la unidad base. "1 litro", "1000 ml" y "X1L" son
 * `v1000`; "medio kilo", "500 g" y "libra" son `m500`.
 */

type Dimension = 'v' | 'm';

/** Unidad escrita -> dimensión y cuánto vale en la unidad base (ml o g). */
const UNIDADES: Record<string, readonly [Dimension, number]> = {
  ml: ['v', 1],
  cc: ['v', 1],
  l: ['v', 1000],
  lt: ['v', 1000],
  lts: ['v', 1000],
  litro: ['v', 1000],
  litros: ['v', 1000],
  g: ['m', 1],
  gr: ['m', 1],
  grs: ['m', 1],
  gramo: ['m', 1],
  gramos: ['m', 1],
  kg: ['m', 1000],
  kgs: ['m', 1000],
  kilo: ['m', 1000],
  kilos: ['m', 1000],
  kilogramo: ['m', 1000],
  kilogramos: ['m', 1000],
  lb: ['m', 500],
  lbs: ['m', 500],
  libra: ['m', 500],
  libras: ['m', 500],
};

/** Cantidades dichas con palabras: "dos litros", "medio kilo". */
const CANTIDADES: Record<string, number> = {
  medio: 0.5,
  media: 0.5,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

// Las más largas primero: con "kg" antes que "kilogramos", la alternancia se quedaría con una unidad incompleta.
const UNIDAD = Object.keys(UNIDADES)
  .sort((a, b) => b.length - a.length)
  .join('|');
const PALABRA = Object.keys(CANTIDADES).join('|');
// Todos los números van acotados (`{1,9}`): sin tope, una tira de miles de dígitos hace que el regex tarde segundos.
// Orden: miles ("1.125"), fracción ("1/2"), decimal ("1,5") y decimal sin entero (".5").
const NUMERO = String.raw`\d{1,3}(?:[.,]\d{3})+|\d{1,9}\s*/\s*\d{1,9}|\d{1,9}(?:[.,]\d{1,9})?|[.,]\d{1,9}`;

/** Prefijo de los tokens de medida ("#v1000"): el buscador solo extrae letras y dígitos, nadie puede teclearlo. */
export const MEDIDA = '#';

function llave(dimension: Dimension, cantidad: number): string {
  return `${MEDIDA}${dimension}${Math.round(cantidad)}`;
}

/**
 * Valor de lo escrito antes de la unidad. "1.125 g" es mil ciento veinticinco gramos (punto de miles); "1.5 kg" es
 * kilo y medio (decimal). Si la unidad ya es la base (ml, g) un punto con tres dígitos detrás es de miles.
 */
function valorDe(texto: string, factor: number): number {
  const t = texto.trim();
  const fraccion = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (fraccion) return Number(fraccion[2]) === 0 ? 0 : Number(fraccion[1]) / Number(fraccion[2]);
  if (factor === 1 && /^\d{1,3}(?:[.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
  return parseFloat(t.replace(',', '.'));
}

function llaveDe(cantidad: string, unidad: string): string {
  const [dimension, factor] = UNIDADES[unidad];
  return llave(dimension, valorDe(cantidad, factor) * factor);
}

/** Cantidad en la unidad base de una llave de medida: "#v1000" -> "1000". */
export const cantidadDe = (medida: string): string => medida.slice(2);

// En el nombre la medida va pegada a otras letras ("X900ML", "ECO900G", "COLANTAX132G"), así que antes del número
// no se exige límite de palabra; solo que no sea parte de otro número ("1900" no es "900"). Después de la unidad no
// puede seguir una letra, salvo "x" + dígito ("900MLX6"). Sin lookbehind: no depende del motor de JS.
const EN_NOMBRE = new RegExp(String.raw`(?:^|[^0-9.,/])(${NUMERO})\s*(${UNIDAD})(?![a-wyz]|x(?!\d))`, 'g');

/** Llaves de las medidas que trae un texto ya normalizado (sin tildes, en minúsculas). Sin repetir. */
export function medidasDeTexto(texto: string): string[] {
  const medidas: string[] = [];
  for (const [, cantidad, unidad] of texto.matchAll(EN_NOMBRE)) {
    const medida = llaveDe(cantidad, unidad);
    if (!medidas.includes(medida)) medidas.push(medida);
  }
  return medidas;
}

// En lo que escribe el vendedor: "900 ml", "1 litro", "1.5l", "1/2 kg", "dos litros", "medio kilo"; y sin número:
// "litro", "libra", "litro y medio". Un número solo cuenta si no es parte de otro ("3/4" no es "4"). Las cantidades
// con palabras necesitan un espacio ("dosl" no es "2 l"). Gana la alternativa que coincide primero.
const EN_BUSQUEDA = new RegExp(
  String.raw`(^|[^0-9.,/])(${NUMERO})\s*(${UNIDAD})(?![a-z])` +
    String.raw`|(^|[^a-z0-9.,/])(${PALABRA})\s+(${UNIDAD})(?![a-z])` +
    String.raw`|(^|[^a-z0-9.,/])litro\s+y\s+medio(?![a-z])` +
    String.raw`|(^|[^a-z0-9.,/])(litro|kilogramo|kilo|libra)s?(?![a-z])`,
  'g',
);

/**
 * Cambia cada medida del texto de una búsqueda (ya normalizado) por un marcador ` #0 `, ` #1 `… y devuelve las
 * llaves en ese orden. Así "leche 1 litro" queda "leche  #0 " con `["#v1000"]` y no se parte en "1" y "litro".
 */
export function separarMedidas(texto: string): { texto: string; medidas: string[] } {
  const medidas: string[] = [];
  const resto = texto.replace(
    EN_BUSQUEDA,
    (
      _: string,
      g1?: string,
      cantidad?: string,
      unidad?: string,
      g2?: string,
      palabra?: string,
      unidad2?: string,
      g3?: string,
      g4?: string,
      suelta?: string,
    ) => {
      const guarda = g1 ?? g2 ?? g3 ?? g4 ?? ''; // el carácter que precedía a la medida se conserva
      if (cantidad !== undefined && unidad !== undefined) medidas.push(llaveDe(cantidad, unidad));
      else if (palabra !== undefined && unidad2 !== undefined) {
        const [dimension, factor] = UNIDADES[unidad2];
        medidas.push(llave(dimension, CANTIDADES[palabra] * factor));
      } else if (suelta !== undefined) {
        const [dimension, factor] = UNIDADES[suelta];
        medidas.push(llave(dimension, factor));
      } else medidas.push(llave('v', 1500)); // "litro y medio"
      return `${guarda} ${MEDIDA}${medidas.length - 1} `;
    },
  );
  return { texto: resto, medidas };
}
