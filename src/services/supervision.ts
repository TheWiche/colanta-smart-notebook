import * as Clipboard from 'expo-clipboard';
import { Linking, Share } from 'react-native';

import { URL_SUPERVISOR_WEB } from '../config';
import { toUrlSafeBase64 } from '../lib/base64';
import { displayCodigo } from '../lib/manualStore';
import { formatHora } from '../lib/rutas';
import type { OrdersByStore } from '../types';
import { SIN_RUTA } from './sheets';

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

const formatDate = (fecha: Date) => `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
const pluralize = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export interface SupervisionItem {
  id: string;
  producto: string;
  cantidad: number;
}

export interface SupervisionOrder {
  codigo: string;
  nombre: string;
  ruta: string;
  alias?: string;
  manual?: boolean;
  sinCodigo?: boolean;
  timestamp: number;
  horaTexto: string;
  items: SupervisionItem[];
}

export interface SupervisionBatch {
  v: 1;
  id: string;
  creadoEn: number;
  fechaTexto: string;
  resumen: {
    totalTiendas: number;
    totalUnidades: number;
  };
  pedidos: SupervisionOrder[];
}

/**
 * Convierte el mapa de pedidos a un lote estructurado para la supervisora.
 */
export function buildSupervisionBatch(pedidos: OrdersByStore, ahora: Date = new Date()): SupervisionBatch | null {
  const conProductos = Object.values(pedidos)
    .filter((pedido) => pedido.items.length > 0)
    .sort((a, b) => a.updatedAt - b.updatedAt);

  if (conProductos.length === 0) return null;

  const ahoraMs = ahora.getTime();
  const batchId = `colanta-${ahoraMs}`;
  const totalUnidades = conProductos
    .flatMap((pedido) => pedido.items)
    .reduce((total, item) => total + item.cantidad, 0);

  return {
    v: 1,
    id: batchId,
    creadoEn: ahoraMs,
    fechaTexto: formatDate(ahora),
    resumen: {
      totalTiendas: conProductos.length,
      totalUnidades,
    },
    pedidos: conProductos.map((pedido, pedidoIdx) => ({
      codigo: displayCodigo(pedido.tienda),
      nombre: pedido.tienda.nombre,
      ruta: pedido.tienda.ruta || SIN_RUTA,
      alias: pedido.tienda.alias,
      manual: pedido.tienda.manual,
      sinCodigo: pedido.tienda.sinCodigo,
      timestamp: pedido.updatedAt,
      horaTexto: formatHora(pedido.updatedAt),
      items: pedido.items.map((item, itemIdx) => ({
        id: `p${pedidoIdx}-i${itemIdx}`,
        producto: item.producto,
        cantidad: item.cantidad,
      })),
    })),
  };
}

/**
 * Genera el enlace web directo al panel de supervisión con el lote codificado en el hash fragment.
 */
export function buildSupervisionUrl(batch: SupervisionBatch, baseUrl: string = URL_SUPERVISOR_WEB): string {
  const json = JSON.stringify(batch);
  const encoded = toUrlSafeBase64(json);
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  return `${cleanBase}/#data=${encoded}`;
}

/**
 * Mensaje didáctico para compartir con la supervisora vía WhatsApp o mensajería.
 */
export function buildSupervisionShareMessage(batch: SupervisionBatch, url: string): string {
  const resumen = [
    batch.fechaTexto,
    pluralize(batch.resumen.totalTiendas, 'tienda', 'tiendas'),
    pluralize(batch.resumen.totalUnidades, 'unidad', 'unidades'),
  ].join(' · ');

  return [
    '📋 *COLANTA SMART - PANEL DE SUPERVISIÓN*',
    `_${resumen}_`,
    '',
    '🔗 *Enlace directo para transcripción y checklist:*',
    url,
    '',
    '👉 *Instrucciones:* Ingresa al enlace para revisar las tiendas y marcar como procesados los productos en el sistema interno.',
  ].join('\n');
}

export type SendResult = 'whatsapp' | 'share' | 'empty';

/**
 * Comparte el enlace del panel de supervisión por WhatsApp o el menú nativo del dispositivo.
 */
export async function shareSupervisionLink(
  pedidos: OrdersByStore,
  baseUrl: string = URL_SUPERVISOR_WEB,
): Promise<{ result: SendResult; url?: string }> {
  const batch = buildSupervisionBatch(pedidos);
  if (!batch) return { result: 'empty' };

  const url = buildSupervisionUrl(batch, baseUrl);
  const mensaje = buildSupervisionShareMessage(batch, url);

  try {
    await Linking.openURL('whatsapp://send?text=' + encodeURIComponent(mensaje));
    return { result: 'whatsapp', url };
  } catch {
    await Share.share({ message: mensaje });
    return { result: 'share', url };
  }
}

/**
 * Copia únicamente la URL del panel web al portapapeles.
 */
export async function copySupervisionUrl(
  pedidos: OrdersByStore,
  baseUrl: string = URL_SUPERVISOR_WEB,
): Promise<{ result: 'copied' | 'empty'; url?: string }> {
  const batch = buildSupervisionBatch(pedidos);
  if (!batch) return { result: 'empty' };

  const url = buildSupervisionUrl(batch, baseUrl);
  if (!(await Clipboard.setStringAsync(url))) throw new Error('No se pudo copiar el enlace al portapapeles.');
  return { result: 'copied', url };
}

/**
 * Abre el panel web de supervisión directamente en el navegador del dispositivo.
 */
export async function openSupervisionInBrowser(
  pedidos: OrdersByStore,
  baseUrl: string = URL_SUPERVISOR_WEB,
): Promise<boolean> {
  const batch = buildSupervisionBatch(pedidos);
  if (!batch) return false;

  const url = buildSupervisionUrl(batch, baseUrl);
  await Linking.openURL(url);
  return true;
}
