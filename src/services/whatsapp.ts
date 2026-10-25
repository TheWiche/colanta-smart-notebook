import * as Clipboard from 'expo-clipboard';
import { Linking, Share } from 'react-native';

import { displayCodigo } from '../lib/manualStore';
import type { OrdersByStore, Store } from '../types';
import { SIN_RUTA } from './sheets';

// A mano y no con Intl/toLocaleDateString: ese resultado cambia según el motor y el dispositivo (Hermes en
// Android); así la fecha sale igual en todos los teléfonos y en las pruebas.
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "Jueves 22 de octubre": hora local, sin año. */
const formatDate = (fecha: Date) => `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;

/** "1 tienda", "3 tiendas". */
const pluralize = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/**
 * Texto que viene de los datos (nombres de la hoja o escritos a mano, rutas). Para que no rompa ni agregue
 * formato, `*`, `_` y `~` pasan a espacio ("Granero *El Paisa*" → "Granero El Paisa") y la comilla invertida a
 * apóstrofo ("D`Luis" → "D'Luis"). Espacios y saltos de línea se colapsan: cada dato queda en su renglón y sin
 * espacios sobrantes.
 */
const sanitize = (text: string) =>
  text
    .replace(/[*_~]/g, ' ')
    .replace(/`/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Dentro de `código` no aplica el formato: solo estorba la comilla invertida, que cerraría el bloque. */
const sanitizeCode = (text: string) => text.replace(/`/g, "'").replace(/\s+/g, ' ').trim();

/** "`RIO-0101` · Ruta 1". La ruta se omite si la tienda no tiene; las creadas a mano llevan "_tienda nueva_". */
function storeMeta(tienda: Store): string {
  const ruta = sanitize(tienda.ruta);
  const partes = [`\`${sanitizeCode(displayCodigo(tienda))}\``];
  if (ruta && ruta !== SIN_RUTA) partes.push(ruta);
  // El nombre con el que la conocen en la calle, para que quien reciba el mensaje la identifique
  const alias = sanitize(tienda.alias ?? '');
  if (alias) partes.push(`_${alias}_`);
  if (tienda.manual) partes.push('_tienda nueva_');
  return partes.join(' · ');
}

/**
 * Arma el mensaje de todos los pedidos pendientes, en el orden en que se tomaron, con el formato de WhatsApp
 * (negrilla, cursiva, código y listas):
 *
 *   📋 *PEDIDOS COLANTA SMART*
 *   _Jueves 22 de octubre · 2 tiendas · 4 unidades_
 *
 *   *1. Granero El Paisa*
 *   `RIO-0101` · Ruta 1
 *   - *2* YOGUR ENTERO FRESA BOLSA X 900G
 *   - *1* KUMIS COLANTA GFA X4L
 *
 *   *2. Tienda La Nueva Esperanza*
 *   `SIN CÓDIGO` · _tienda nueva_
 *   - *1* KUMIS COLANTA GFA X4L
 *
 * Una línea en blanco entre el encabezado y cada tienda. Pedidos vacíos se omiten; si no queda ninguno devuelve
 * ''. `ahora` es la fecha del encabezado (se fija en las pruebas).
 */
export function buildOrdersText(pedidos: OrdersByStore, ahora: Date = new Date()): string {
  const conProductos = Object.values(pedidos)
    .filter((pedido) => pedido.items.length > 0)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  if (conProductos.length === 0) return '';

  const items = conProductos.flatMap((pedido) => pedido.items);
  const unidadesCobro = items.filter((item) => !item.esCambio).reduce((total, item) => total + item.cantidad, 0);
  const unidadesCambio = items.filter((item) => item.esCambio).reduce((total, item) => total + item.cantidad, 0);

  const partesResumen = [
    formatDate(ahora),
    pluralize(conProductos.length, 'tienda', 'tiendas'),
    pluralize(unidadesCobro, 'unidad', 'unidades'),
  ];
  if (unidadesCambio > 0) {
    partesResumen.push(pluralize(unidadesCambio, 'cambio', 'cambios'));
  }
  const resumen = partesResumen.join(' · ');

  const bloques = conProductos.map((pedido, i) =>
    [
      `*${i + 1}. ${sanitize(pedido.tienda.nombre)}*`,
      storeMeta(pedido.tienda),
      ...pedido.items.map(
        (item) => `- *${item.cantidad}* ${sanitize(item.producto)}${item.esCambio ? ' [CAMBIO]' : ''}`,
      ),
    ].join('\n'),
  );

  return [`📋 *PEDIDOS COLANTA SMART*\n_${resumen}_`, ...bloques].join('\n\n');
}

export type SendResult = 'whatsapp' | 'share' | 'empty';

/**
 * Abre WhatsApp con todos los pedidos. Si WhatsApp no está instalado (openURL falla),
 * abre el menú de compartir del sistema con el mismo texto para no perder el envío.
 */
export async function sendOrdersByWhatsApp(pedidos: OrdersByStore): Promise<SendResult> {
  const texto = buildOrdersText(pedidos);
  if (!texto) return 'empty';

  try {
    await Linking.openURL('whatsapp://send?text=' + encodeURIComponent(texto));
    return 'whatsapp';
  } catch {
    await Share.share({ message: texto });
    return 'share';
  }
}

export type CopyResult = 'copied' | 'empty';

/**
 * Copia al portapapeles el mismo mensaje que se envía por WhatsApp, para pegarlo donde se necesite. Sin pedidos
 * no toca el portapapeles. Lanza un error si no se pudo copiar (en Android e iOS `setStringAsync` siempre
 * resuelve `true`; en web puede resolver `false`).
 */
export async function copyOrdersToClipboard(pedidos: OrdersByStore): Promise<CopyResult> {
  const texto = buildOrdersText(pedidos);
  if (!texto) return 'empty';

  if (!(await Clipboard.setStringAsync(texto))) throw new Error('No se pudo copiar el mensaje.');
  return 'copied';
}
