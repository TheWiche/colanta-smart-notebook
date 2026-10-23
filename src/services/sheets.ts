import Papa from 'papaparse';

import { normalize } from '../lib/normalize';
import type { EstadoCoincidencia, Product, Store } from '../types';

const FETCH_TIMEOUT_MS = 15000;
// El encabezado casi siempre está en las primeras filas; más allá no se busca (evita confundir datos con títulos).
const HEADER_SCAN_ROWS = 40;

interface ColumnSpec<K extends string> {
  key: K;
  /** Nombre legible, para los mensajes de error. */
  label: string;
  /** Se prueba contra el texto del encabezado sin tildes ni mayúsculas. Anclado al inicio: ignora títulos largos. */
  pattern: RegExp;
  required: boolean;
}

/**
 * Ruta asignada a las tiendas de un CSV suelto cuya fila no trae ruta: no se pierden, quedan agrupadas aquí.
 * Al leer el documento entero no hace falta: ahí la ruta por defecto es el nombre de la hoja.
 */
export const SIN_RUTA = 'Sin ruta';

type TiendaColumn = 'ruta' | 'codigo' | 'nombre' | 'alias';

// Solo el nombre es obligatorio. La ruta es opcional: sin esa columna la ruta es el nombre de la hoja (documento
// entero) o "Sin ruta" (CSV suelto). El código también: una tienda puede no tenerlo todavía y se le genera un id.
// El nombre secundario (otra columna opcional) va antes que "nombre" y este lo excluye, para que "Nombre secundario"
// no se tome por el nombre principal.
// También sirve "Referencia / Alias / Ubicación": cómo la conocen o dónde queda, lo que ayuda a ubicarla en la calle.
const ALIAS =
  /^(nombre\s+(secundario|alterno|alternativo|real|2|dos)|segundo\s+nombre|otro\s+nombre|alias|apodo|sobrenombre|referencia|ubicacion)\b/;
const TIENDA_COLUMNS: ColumnSpec<TiendaColumn>[] = [
  { key: 'ruta', label: 'Ruta', pattern: /^ruta\b/, required: false },
  { key: 'codigo', label: 'Código', pattern: /^(codigo|cod)\b/, required: false },
  { key: 'alias', label: 'Nombre secundario', pattern: ALIAS, required: false },
  { key: 'nombre', label: 'Nombre', pattern: /^(nombre|tienda|cliente)\b(?!\s+(secundario|alterno|alternativo|real|2|dos))/, required: true },
];

// Encabezados reales: "Código", "Nombre del Producto (Catálogo)", "Alias (Hoja 1)", "Estado de Coincidencia".
// Solo hace falta uno de los dos nombres (catálogo o alias): hay productos que solo están en la Hoja 1.
type ProductoColumn = 'codigo' | 'catalogo' | 'alias' | 'estado';
const PRODUCTO_COLUMNS: ColumnSpec<ProductoColumn>[] = [
  { key: 'codigo', label: 'Código', pattern: /^(codigo|cod|referencia|ref|sku)\b/, required: false },
  { key: 'alias', label: 'Alias', pattern: /^alias\b/, required: false },
  { key: 'estado', label: 'Estado de Coincidencia', pattern: /^estado\b/, required: false },
  {
    key: 'catalogo',
    label: 'Nombre del Producto',
    pattern: /^(nombre del producto|nombre producto|producto|descripcion|articulo|nombre)\b/,
    required: true,
  },
];

/** Espacios colapsados y sin extremos. */
const clean = (value: string | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

/** Hoja sin ningún dato: Google la publica como un CSV de 0 bytes (a lo sumo, comas de celdas vacías). */
const CSV_VACIO = /^[\s,"]*$/;

export interface TiendasResult {
  tiendas: Store[];
  /** Hojas publicadas que no aportaron tiendas (vacías o sin columnas de tienda), en orden. */
  hojasOmitidas: string[];
}

/**
 * Descarga las tiendas con código y nombre, sin duplicados de ruta+código.
 *
 * Cada hoja es una ruta: si la URL publica el documento entero de Google Sheets (sin `gid`), se leen todas sus
 * hojas en el orden de las pestañas y el nombre de cada pestaña es la ruta de sus tiendas (si la hoja trae columna
 * "Ruta", el valor de la fila manda). Las hojas vacías o sin columnas de tienda se saltan y se informan en
 * `hojasOmitidas`; si todas están vacías, la lista llega vacía y decide quien llama. Si una hoja no se puede
 * descargar falla todo: nunca quedan rutas a medias.
 *
 * Una URL con `gid` (una sola hoja) o de otro sitio se lee como un único CSV: la ruta sale de la columna "Ruta" y
 * las filas sin ruta quedan en `SIN_RUTA` (no se descartan: el vendedor tiene que poder visitarlas igual).
 */
export async function fetchTiendas(url: string): Promise<TiendasResult> {
  const docId = publishedDocumentId(url);
  if (docId) {
    // La lista de pestañas viene en HTML: no pasa por el chequeo de "no devolvió un CSV".
    const hojas = parsePublishedTabs(await download(publishedTabsUrl(docId), 'Tiendas'));
    if (hojas.length > 0) return fetchTiendasPorHoja(docId, hojas);
    // Sin pestañas reconocibles (p. ej. Google cambió esa página): se lee la URL tal cual, como un CSV suelto.
  }

  const tiendas = uniqueTiendas(toTiendas(await fetchTable(url, 'Tiendas', TIENDA_COLUMNS), SIN_RUTA));
  if (tiendas.length === 0) throw new Error('Tiendas: el CSV no tiene filas válidas.');
  return { tiendas, hojasOmitidas: [] };
}

/** Lee cada hoja del documento publicado como una ruta (ver `fetchTiendas`). */
async function fetchTiendasPorHoja(docId: string, hojas: PublishedTab[]): Promise<TiendasResult> {
  // En paralelo y todo o nada: si una hoja no baja (red, HTTP, tiempo de espera), falla la sincronización entera.
  const textos = await Promise.all(
    hojas.map(async (hoja) => {
      const label = hojaLabel(hoja);
      const text = await download(publishedTabCsvUrl(docId, hoja.gid), label);
      assertCsv(text, label);
      return text;
    }),
  );

  let columnError: unknown;
  const porHoja = hojas.map((hoja, i): Store[] => {
    if (CSV_VACIO.test(textos[i])) return [];
    let rows: Record<TiendaColumn, string>[];
    try {
      rows = readTable(textos[i], hojaLabel(hoja), TIENDA_COLUMNS);
    } catch (error) {
      // Hoja sin columnas de tienda (p. ej. de notas): se salta, pero se guarda el motivo.
      if (columnError === undefined) columnError = error;
      return [];
    }
    return toTiendas(rows, hoja.nombre);
  });

  const tiendas = uniqueTiendas(porHoja.flat());
  // Ninguna hoja aportó tiendas y alguna tenía las columnas mal: eso es lo que hay que corregir en la hoja.
  if (tiendas.length === 0 && columnError !== undefined) throw columnError;
  return {
    tiendas,
    hojasOmitidas: hojas.filter((_, i) => porHoja[i].length === 0).map((hoja) => hoja.nombre),
  };
}

const hojaLabel = (hoja: PublishedTab) => `Tiendas, hoja «${hoja.nombre}»`;

/** Filas con código y nombre, como tiendas. `rutaPorDefecto` cubre las que no traen ruta propia. */
function toTiendas(rows: Record<TiendaColumn, string>[], rutaPorDefecto: string): Store[] {
  const tiendas: Store[] = [];
  const idsUsados = new Set<string>();
  for (const row of rows) {
    const nombre = clean(row.nombre);
    if (!nombre) continue;
    const ruta = clean(row.ruta) || rutaPorDefecto;
    const alias = clean(row.alias);
    const tienda: Store = { ruta, codigo: clean(row.codigo), nombre };
    if (alias && normalize(alias) !== normalize(nombre)) tienda.alias = alias;
    if (!tienda.codigo) {
      // Sin código: id propio, estable entre sincronizaciones (ruta + nombre) para que el pedido siga siendo de la
      // misma tienda. Dos tiendas sin código y con el mismo nombre en la ruta se numeran.
      const base = `sc-${slug(ruta)}-${slug(nombre)}`;
      let id = base;
      for (let n = 2; idsUsados.has(id); n++) id = `${base}-${n}`;
      idsUsados.add(id);
      tienda.codigo = id;
      tienda.sinCodigo = true;
    }
    tiendas.push(tienda);
  }
  return tiendas;
}

/** Texto reducido a letras y números unidos por guiones, para armar ids legibles. */
const slug = (texto: string) => normalize(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Sin repetidos, en el orden de llegada (hojas en orden y filas en el orden de cada hoja). */
function uniqueTiendas(tiendas: Store[]): Store[] {
  const seen = new Set<string>();
  return tiendas.filter(({ ruta, codigo }) => {
    // Una tienda puede estar en varias rutas: se deduplica por ruta+código, no solo por código.
    const key = `${ruta}|${codigo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Descarga el catálogo en el orden de la hoja. Cada fila trae código (opcional), nombre de catálogo y alias (cada uno
 * opcional, pero al menos uno). `nombre` es con lo que se pide: el alias si lo hay y, si no, el nombre de catálogo.
 * Los productos solo de la Hoja 1 (sin nombre de catálogo) usan su alias también como nombre de catálogo.
 * Las filas sin ningún nombre (títulos, separadores) se descartan.
 */
export async function fetchProductos(url: string): Promise<Product[]> {
  const rows = await fetchTable(url, 'Productos', PRODUCTO_COLUMNS);
  const seen = new Set<string>();
  const productos: Product[] = [];

  for (const row of rows) {
    const alias = clean(row.alias);
    const nombreCatalogo = clean(row.catalogo) || alias;
    const nombre = alias || nombreCatalogo;
    if (!nombre) continue;
    const codigo = clean(row.codigo);
    // La fila repetida exacta no se conserva
    const key = [codigo, nombre].join('\u001f');
    if (seen.has(key)) continue;
    seen.add(key);
    productos.push({ nombre, codigo, nombreCatalogo, alias, estado: estadoDe(row.estado, alias, clean(row.catalogo)) });
  }

  if (productos.length === 0) throw new Error('Productos: el CSV no tiene filas válidas.');
  return productos;
}

/** El estado que dice la hoja; si falta o es otro texto, se deduce de qué nombres trae la fila. */
function estadoDe(texto: string | undefined, alias: string, catalogo: string): EstadoCoincidencia {
  const dicho = normalize(texto ?? '');
  if (dicho.startsWith('coincide')) return 'Coincide en ambas';
  if (dicho.includes('hoja 1')) return 'Solo en Hoja 1';
  if (dicho.includes('catalogo')) return 'Solo en Catálogo';
  return alias && catalogo ? 'Coincide en ambas' : alias ? 'Solo en Hoja 1' : 'Solo en Catálogo';
}

/** Pestaña de un documento publicado en la web. Con la convención "cada hoja es una ruta", su nombre es la ruta. */
export interface PublishedTab {
  nombre: string;
  /** Id de la hoja dentro del documento (el `gid` de las URLs). */
  gid: string;
}

const PUBLISHED_BASE = 'https://docs.google.com/spreadsheets/d/e/';
// Documento publicado con Archivo > Compartir > Publicar en la Web: .../d/e/<id>/pub?output=csv, .../d/e/<id>/pubhtml.
const PUBLISHED_URL = /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([\w-]+)\/pub(?:html)?(?:[?#]|$)/i;

/**
 * Id de publicación (`2PACX-…`) si la URL publica el documento entero de Google Sheets; `null` si es de otro sitio o
 * pide una hoja concreta (`gid`). Sin `gid`, el CSV de Google solo trae la primera hoja: por eso las demás hojas
 * (rutas) se descubren aparte.
 */
export function publishedDocumentId(url: string): string | null {
  const base = url.trim();
  const match = PUBLISHED_URL.exec(base);
  // Lo que va después de "#" no llega al servidor: solo cuenta un `gid` de la query.
  if (!match || /[?&]gid=/.test(base.split('#')[0])) return null;
  return match[1];
}

/** Página HTML del documento publicado: es la que trae la lista de pestañas (nombre y gid de cada una). */
export function publishedTabsUrl(docId: string): string {
  return `${PUBLISHED_BASE}${docId}/pubhtml`;
}

/** CSV de una sola hoja del documento publicado. */
export function publishedTabCsvUrl(docId: string, gid: string): string {
  return `${PUBLISHED_BASE}${docId}/pub?gid=${encodeURIComponent(gid)}&single=true&output=csv`;
}

// Literal de texto de JS ("…" o '…') con sus escapes.
const JS_STRING = String.raw`"(?:[^"\\\r\n]|\\[\s\S])*"|'(?:[^'\\\r\n]|\\[\s\S])*'`;
// En el HTML de pubhtml cada pestaña es `items.push({name: "Ruta 1", pageUrl: "…", gid: "0", …});`. Los textos se
// consumen enteros: una "}" o un "gid:" dentro de un nombre no cortan la entrada.
const TAB_ENTRY = new RegExp(String.raw`items\.push\(\{((?:${JS_STRING}|[^"'}])*)\}\)`, 'g');
// `clave: "texto"` o `clave: 123`. Los demás textos se saltan enteros para no leer claves dentro de ellos.
const TAB_PROPERTY = new RegExp(String.raw`(\w+)\s*:\s*(${JS_STRING}|\d+)|${JS_STRING}`, 'g');
const JS_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };

/**
 * Pestañas del documento, en orden, leídas del HTML de `publishedTabsUrl`. Los nombres llegan con los escapes de JS
 * resueltos (\", \/, \xHH, \uHHHH…) y los espacios colapsados; un gid repetido cuenta una sola vez.
 * Devuelve `[]` si la página no trae la lista (otra página, o Google cambió el formato).
 */
export function parsePublishedTabs(html: string): PublishedTab[] {
  const tabs: PublishedTab[] = [];
  const gids = new Set<string>();
  for (const [, body] of html.matchAll(TAB_ENTRY)) {
    const props = new Map<string, string>();
    for (const [, key, value] of body.matchAll(TAB_PROPERTY)) {
      if (key && !props.has(key)) props.set(key, /^["']/.test(value) ? decodeJsString(value) : value);
    }
    const nombre = clean(props.get('name'));
    const gid = clean(props.get('gid'));
    if (!nombre || !gid || gids.has(gid)) continue;
    gids.add(gid);
    tabs.push({ nombre, gid });
  }
  return tabs;
}

/** Contenido de un literal de texto de JS, con sus escapes resueltos. */
function decodeJsString(literal: string): string {
  return literal
    .slice(1, -1)
    .replace(
      /\\(?:x([\da-fA-F]{2})|u([\da-fA-F]{4})|u\{([\da-fA-F]+)\}|([\s\S]))/g,
      (_, x?: string, u?: string, codePoint?: string, char = '') => {
        const hex = x ?? u ?? codePoint;
        if (hex === undefined) return JS_ESCAPES[char] ?? char;
        const code = parseInt(hex, 16);
        return code <= 0x10ffff ? String.fromCodePoint(code) : '';
      },
    );
}

async function fetchTable<K extends string>(
  url: string,
  label: string,
  columns: ColumnSpec<K>[],
): Promise<Record<K, string>[]> {
  const text = await download(url, label);
  assertCsv(text, label);
  return readTable(text, label, columns);
}

/** `fetchText` con el error que ve el vendedor: "<label>: no se pudo descargar (motivo)." */
function download(url: string, label: string): Promise<string> {
  return fetchText(url).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: no se pudo descargar (${reason}).`);
  });
}

/** Un link de edición o una hoja sin publicar devuelven HTML en vez de CSV. */
function assertCsv(text: string, label: string): void {
  if (/^\s*</.test(text)) {
    throw new Error(
      `${label}: la URL no devolvió un CSV. Publica la hoja en Archivo > Compartir > Publicar en la Web > CSV.`,
    );
  }
}

/**
 * Lee un CSV cuyo encabezado puede no estar en la primera fila (títulos, filas vacías) y cuyos datos pueden
 * traer filas intermedias (banners). Devuelve un objeto por fila con todas las columnas del `columns`
 * ('' si la hoja no la trae). Sin `dynamicTyping`: los códigos se conservan como texto ("0409" no pasa a 409).
 */
export function readTable<K extends string>(
  text: string,
  label: string,
  columns: ColumnSpec<K>[],
): Record<K, string>[] {
  const { data } = Papa.parse<string[]>(text, {
    delimiter: ',', // Google Sheets siempre exporta con coma; evita una autodetección errónea.
    skipEmptyLines: 'greedy', // también omite filas vacías como ",,".
    transform: (value) => value.trim(),
  });

  // Encabezado = la primera fila que trae todas las columnas obligatorias. Los títulos largos y los banners no
  // encajan con los patrones (anclados al inicio). Si ninguna cumple, se queda la que más reconoce, solo para
  // poder decir qué columnas faltan.
  let headerRow = -1;
  let completo = false;
  let found = new Map<K, number>();
  for (let i = 0; i < Math.min(data.length, HEADER_SCAN_ROWS); i++) {
    const candidate = new Map<K, number>();
    data[i].forEach((cell, col) => {
      const normalized = normalize(cell).replace(/\s+/g, ' ');
      const spec = columns.find((c) => !candidate.has(c.key) && c.pattern.test(normalized));
      if (spec) candidate.set(spec.key, col);
    });
    const hasAllRequired = columns.every((c) => !c.required || candidate.has(c.key));
    const hasAnyRequired = columns.some((c) => c.required && candidate.has(c.key));
    if (hasAllRequired && hasAnyRequired) {
      // Gana la fila que reconoce más columnas (el encabezado real, no un título que empieza con "Nombre…"); a
      // igualdad, la primera. Una fila de datos nunca reconoce tantas.
      if (!completo || candidate.size > found.size) {
        headerRow = i;
        found = candidate;
        completo = true;
      }
      continue;
    }
    if (!completo && hasAnyRequired && candidate.size > found.size) {
      headerRow = i;
      found = candidate;
    }
  }

  const missing = columns.filter((c) => c.required && !found.has(c.key));
  if (missing.length > 0) throw new Error(`${label}: faltan las columnas ${missing.map((c) => c.label).join(', ')}.`);

  return data.slice(headerRow + 1).map((row) => {
    const record = {} as Record<K, string>;
    for (const c of columns) {
      const col = found.get(c.key);
      record[c.key] = col === undefined ? '' : (row[col] ?? '');
    }
    return record;
  });
}

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const base = url.trim();
  if (!/^https?:\/\//i.test(base)) throw new Error('URL inválida');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Parámetro anti-caché: evita que la caché HTTP del dispositivo devuelva un CSV viejo.
    const response = await fetch(`${base}${base.includes('?') ? '&' : '?'}_=${Date.now()}`, {
      signal: controller.signal,
      // Además del parámetro anti-caché: que ninguna caché intermedia (la del teléfono, un proxy) responda por Google.
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new Error('tiempo de espera agotado');
    if (error instanceof Error && /^HTTP \d+$/.test(error.message)) throw error;
    // Cualquier otra falla es de red: TypeError en el fetch clásico, "fetch failed: java.io.IOException…" en
    // Android. Ese texto técnico no le sirve al vendedor.
    throw new Error('sin conexión a internet');
  } finally {
    clearTimeout(timer);
  }
}
