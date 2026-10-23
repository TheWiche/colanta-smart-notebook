import type { Product } from '../types';

/**
 * Lleva `productos` guardados por versiones anteriores a la forma actual.
 *  - v1 guardaba solo los nombres (`string[]`).
 *  - v2 guardaba `{ nombre, categoria, subcategoria, referencia }`.
 * Ambos quedan como productos de catálogo sin alias hasta la próxima sincronización, que trae el catálogo nuevo.
 * El nombre se conserva tal cual: los pedidos guardados siguen apuntando a él.
 */
export function migrateProductos(productos: unknown): Product[] {
  if (!Array.isArray(productos)) return [];
  return productos.flatMap((item): Product[] => {
    if (typeof item === 'string') {
      return item ? [{ nombre: item, codigo: '', nombreCatalogo: item, alias: '', estado: 'Solo en Catálogo' }] : [];
    }
    if (item && typeof item === 'object' && typeof (item as { nombre?: unknown }).nombre === 'string') {
      const p = item as { nombre: string; referencia?: unknown; codigo?: unknown };
      const codigo = typeof p.codigo === 'string' ? p.codigo : typeof p.referencia === 'string' ? p.referencia : '';
      return [{ nombre: p.nombre, codigo, nombreCatalogo: p.nombre, alias: '', estado: 'Solo en Catálogo' }];
    }
    return [];
  });
}

/** Versión actual del estado persistido. Súbela cada vez que cambie su forma y agrega el paso en `migratePersistedState`. */
export const PERSIST_VERSION = 3;

export function migratePersistedState(persisted: unknown, version: number): Record<string, unknown> {
  const state: Record<string, unknown> = { ...(persisted as Record<string, unknown>) };
  if (version < 3) state.productos = migrateProductos(state.productos);
  return state;
}
