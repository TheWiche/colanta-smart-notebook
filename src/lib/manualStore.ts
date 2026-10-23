import type { Store } from '../types';

/** Texto que sale en el mensaje de WhatsApp en el lugar del código, para que se sepa que la tienda es nueva. */
export const SIN_CODIGO = 'SIN CÓDIGO';

const MAX_NAME_LENGTH = 60;
const MIN_NAME_LENGTH = 2;

/** Espacios colapsados, sin extremos y con un tope de largo. */
export const cleanStoreName = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);

export const isValidStoreName = (text: string) => cleanStoreName(text).length >= MIN_NAME_LENGTH;

/** Id único y legible para una tienda manual. Nunca choca con un código real de la hoja. */
export function newManualStoreId(now: number = Date.now(), random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 3)
    .toString(36)
    .padStart(3, '0');
  return `manual-${now.toString(36)}${suffix}`;
}

export function createManualStore(id: string, nombre: string, ruta = ''): Store {
  return { codigo: id, nombre: cleanStoreName(nombre), ruta, manual: true };
}

/** Código que se le muestra al usuario y que sale en WhatsApp. */
export const displayCodigo = (tienda: Store) => (tienda.manual || tienda.sinCodigo ? SIN_CODIGO : tienda.codigo);
