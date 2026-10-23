import type { Product } from '../types';
import { WEIGHT, buildIndex, search } from './search';
import type { SearchIndex, SearchResult } from './search';

// Separador invisible para armar llaves compuestas (código + nombre).
const SEP = '\u001f';

/** Llave única de la fila de un producto en la lista. */
export const productKey = (p: Product) => `${p.codigo}${SEP}${p.nombre}`;

// --- Búsqueda -------------------------------------------------------------------------------------

/** Tope de productos con solo algunas palabras: más abajo ya no ayudan a encontrar nada. */
export const MAX_PARCIALES = 30;

/**
 * Índice de búsqueda del catálogo: alias, nombre de catálogo y código pesan igual. Los nombres vienen abreviados
 * ("L.UHT …"), por eso se busca en los dos: el alias suele traer las palabras completas ("LECHE ENTERA X 900").
 */
export const buildSearchIndex = (productos: readonly Product[]): SearchIndex<Product> =>
  buildIndex(productos, (p) => [
    { text: p.alias, weight: WEIGHT.strong, medidas: true },
    // Si la fila solo está en la Hoja 1 el nombre de catálogo repite el alias: no se cuenta dos veces.
    { text: p.nombreCatalogo === p.alias ? '' : p.nombreCatalogo, weight: WEIGHT.strong, medidas: true },
    { text: p.codigo, weight: WEIGHT.strong, codigo: true },
  ]);

export type ProductSearch = SearchResult<Product>;

/** Primero los productos con alias (los de rotación común), luego el resto; cada grupo conserva su orden. */
const prioritarios = (lista: Product[]): Product[] => [
  ...lista.filter((p) => p.alias !== ''),
  ...lista.filter((p) => p.alias === ''),
];

/**
 * Busca palabra por palabra: "leche 900", "900 leche" y "leche de 900" encuentran lo mismo.
 * Nivel 1: coincidencias en productos con alias. Nivel 2: las de productos de catálogo sin alias, más abajo.
 * Esto vale para `todas` y para `algunas` (recortada a `MAX_PARCIALES`). Sin texto: todo el catálogo, con alias primero.
 */
export function searchProducts(index: SearchIndex<Product>, query: string): ProductSearch {
  const result = search(index, query);
  return { ...result, todas: prioritarios(result.todas), algunas: prioritarios(result.algunas).slice(0, MAX_PARCIALES) };
}

// --- Secciones de la lista ------------------------------------------------------------------------

export type CatalogRow = { kind: 'producto'; key: string; product: Product };

export interface CatalogSection {
  key: string;
  /** Sin título = lista plana (no se dibuja encabezado). */
  titulo?: string;
  data: CatalogRow[];
  total: number;
  /** Nombres de pedido de los productos de la sección, para contar cuántos van en el pedido. */
  nombres: string[];
}

function section(key: string, titulo: string | undefined, productos: readonly Product[]): CatalogSection {
  return {
    key,
    titulo,
    data: productos.map((product) => ({ kind: 'producto', key: productKey(product), product })),
    total: productos.length,
    nombres: productos.map((p) => p.nombre),
  };
}

/**
 * Cómo se muestra el resultado:
 *  - sin búsqueda: "Frecuentes" (los que tienen alias) y "Resto del catálogo";
 *  - una palabra: una sola lista, con los de alias arriba;
 *  - varias palabras: "Coinciden todas las palabras" y "Coinciden algunas palabras".
 * Las secciones vacías no salen.
 */
export function buildSections(resultado: ProductSearch): CatalogSection[] {
  const { palabras, todas, algunas } = resultado;
  if (palabras.length === 0) {
    const frecuentes = todas.filter((p) => p.alias !== '');
    const resto = todas.filter((p) => p.alias === '');
    // Un catálogo sin alias (hoja antigua) es una lista plana
    if (frecuentes.length === 0) return resto.length > 0 ? [section('catalogo', undefined, resto)] : [];
    return [section('frecuentes', 'Frecuentes', frecuentes), section('resto', 'Resto del catálogo', resto)].filter(
      (s) => s.total > 0,
    );
  }
  if (palabras.length === 1) return todas.length > 0 ? [section('resultados', undefined, todas)] : [];
  return [
    section('todas', 'Coinciden todas las palabras', todas),
    section('algunas', 'Coinciden algunas palabras', algunas),
  ].filter((s) => s.total > 0);
}
