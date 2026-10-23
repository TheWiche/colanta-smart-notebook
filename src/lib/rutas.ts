import type { Order, OrdersByStore, RutaActiva, Store } from '../types';

/** Pedidos de las tiendas de una ruta (incluye las tiendas nuevas que se atendieron en ella). */
export const pedidosDeRuta = (pedidos: OrdersByStore, ruta: string): Order[] =>
  Object.values(pedidos).filter((pedido) => pedido.tienda.ruta === ruta);

/** Pedidos que todavía no se han enviado por WhatsApp. */
export const sinEnviar = (pedidos: readonly Order[]): Order[] => pedidos.filter((pedido) => !pedido.enviadoEn);

/** `ts` cae en el mismo día (hora local) que `ahora`. */
export function esDeHoy(ts: number, ahora = new Date()): boolean {
  const d = new Date(ts);
  return (
    d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth() && d.getDate() === ahora.getDate()
  );
}

/**
 * Avance de la ruta: tiendas gestionadas sobre el total. Gestionada = con pedido o visitada sin pedido ("sin pedido
 * hoy"): así la ruta puede llegar al 100% aunque no todas las tiendas compren. El total son las tiendas de la ruta en
 * la hoja más las tiendas nuevas (no registradas) que se atendieron en ella.
 */
export function avanceRuta(
  ruta: RutaActiva,
  tiendas: readonly Store[],
): { atendidas: number; conPedido: number; sinPedido: number; total: number } {
  const deLaHoja = new Set(tiendas.filter((t) => t.ruta === ruta.nombre).map((t) => t.codigo));
  const nuevas = ruta.atendidas.filter((codigo) => !deLaHoja.has(codigo)).length;
  const sinPedido = (ruta.sinPedido ?? []).filter((codigo) => !ruta.atendidas.includes(codigo));
  return {
    atendidas: ruta.atendidas.length + sinPedido.length,
    conPedido: ruta.atendidas.length,
    sinPedido: sinPedido.length,
    total: deLaHoja.size + nuevas,
  };
}

/** "7:42 a. m." */
export function formatHora(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/** Hora de inicio; si no fue hoy, también el día (una ruta puede quedar abierta de un día para otro). */
export function formatInicio(ts: number): string {
  if (esDeHoy(ts)) return formatHora(ts);
  return new Date(ts).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
