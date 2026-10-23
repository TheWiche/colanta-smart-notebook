import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { pedidosDeRuta } from '../lib/rutas';
import { fetchProductos, fetchTiendas, SIN_RUTA } from '../services/sheets';
import type {
  OrderItem,
  OrdersByStore,
  Product,
  ProductName,
  RutaActiva,
  RutaConcluida,
  Store,
  SyncSummary,
} from '../types';
import { migratePersistedState, PERSIST_VERSION } from './migrations';

/**
 * Parte del estado que se guarda en AsyncStorage.
 * Los campos nuevos que falten en un estado guardado por una versión anterior toman su valor
 * inicial (persist mezcla lo guardado sobre el estado inicial), así que agregarlos no requiere migración.
 */
interface PersistedState {
  /** Rutas únicas, en el orden en que aparecen en la hoja de tiendas. */
  rutas: string[];
  tiendas: Store[];
  /** Catálogo plano en el orden de la hoja. */
  productos: Product[];
  /** Pedidos pendientes por código de tienda (o id generado, si la tienda es manual). */
  pedidos: OrdersByStore;
  /** Epoch ms de la última sincronización exitosa; `null` si nunca se sincronizó. */
  lastSyncAt: number | null;
  /** Ruta que se está recorriendo; `null` si no hay ninguna iniciada. */
  rutaActiva: RutaActiva | null;
}

export interface NotebookState extends PersistedState {
  /** Hay una sincronización en curso. No se persiste. */
  isSyncing: boolean;
  /**
   * AsyncStorage ya cargó el estado guardado. No se persiste.
   * La UI debe esperar a `true` antes de leer o modificar datos: lo que se escriba
   * antes de la hidratación queda pisado por lo guardado.
   */
  hasHydrated: boolean;

  /**
   * Descarga y valida ambos CSV y luego reemplaza rutas, tiendas y productos.
   * Si algo falla lanza un `Error` con mensaje legible y conserva los datos actuales.
   * Nunca toca `pedidos`. Una llamada durante otra sincronización devuelve la misma promesa.
   */
  syncData: (urlTiendas: string, urlProductos: string) => Promise<SyncSummary>;
  /** Suma `cantidad` (por defecto 1) al producto en el pedido de la tienda; crea el pedido si no existe. */
  addOrderItem: (tienda: Store, producto: ProductName, cantidad?: number) => void;
  /** Fija la cantidad exacta del producto (crea el ítem si falta); `cantidad <= 0` lo quita. */
  setOrderItemQuantity: (tienda: Store, producto: ProductName, cantidad: number) => void;
  /** Quita el producto del pedido; si el pedido queda vacío, lo elimina. */
  removeOrderItem: (codigoTienda: string, producto: ProductName) => void;
  /**
   * Reemplaza de una vez todos los ítems del pedido de la tienda (un solo guardado).
   * Descarta cantidades inválidas o <= 0; si no queda ninguno, elimina el pedido.
   */
  saveOrder: (tienda: Store, items: OrderItem[]) => void;
  /** Sin argumento borra todos los pedidos; con código, solo el de esa tienda. No cambia el avance de la ruta. */
  clearOrders: (codigoTienda?: string) => void;
  /**
   * Pone `nombre` como ruta en curso, desde cero: las rutas son siempre las mismas y cada vez que se inicia es una
   * jornada nueva. Si había otra en curso, queda reemplazada. Los pedidos pendientes de la ruta cuentan como atendidos.
   */
  iniciarRuta: (nombre: string) => void;
  /**
   * Marca la tienda como visitada sin pedido ("gestionada hoy"): cuenta para el avance de la ruta igual que una con
   * pedido. No hace nada si no hay ruta en curso o si la tienda ya tiene pedido.
   */
  marcarSinPedido: (codigoTienda: string) => void;
  /** Quita la marca de "sin pedido". */
  quitarSinPedido: (codigoTienda: string) => void;
  /**
   * Marca los pedidos como enviados (se abrió WhatsApp con ellos). Un cambio posterior al pedido quita la marca.
   */
  marcarEnviados: (codigos: string[]) => void;
  /** Quita la marca de enviado: el pedido vuelve a estar pendiente. */
  marcarPendiente: (codigo: string) => void;
  /**
   * Finaliza la ruta en curso y BORRA los pedidos de sus tiendas, enviados o no (quien llama debe haber confirmado).
   * Devuelve la ruta con cuántos pedidos se borraron, o `null` si no había ninguna en curso.
   */
  finalizarRuta: () => RutaConcluida | null;
}

// Sincronización en curso: un doble toque reutiliza la misma descarga en vez de lanzar otra.
let pendingSync: Promise<SyncSummary> | null = null;

export const useStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      rutas: [],
      tiendas: [],
      productos: [],
      pedidos: {},
      lastSyncAt: null,
      rutaActiva: null,
      isSyncing: false,
      hasHydrated: false,

      syncData: (urlTiendas, urlProductos) => {
        if (pendingSync) return pendingSync;

        set({ isSyncing: true });
        pendingSync = (async () => {
          // Ambos CSV deben llegar y validarse antes de escribir: nunca queda un catálogo a medias.
          const [{ tiendas, hojasOmitidas }, productos] = await Promise.all([
            fetchTiendas(urlTiendas),
            fetchProductos(urlProductos),
          ]);
          // Una hoja vaciada por error no debe dejar al preventista sin rutas en la calle.
          if (tiendas.length === 0) {
            throw new Error('Tiendas: la hoja no trajo ninguna tienda. Se conserva el catálogo anterior.');
          }
          const rutas = [...new Set(tiendas.map((tienda) => tienda.ruta))];
          set({ rutas, tiendas, productos, lastSyncAt: Date.now() });
          return {
            rutas: rutas.length,
            tiendas: tiendas.length,
            productos: productos.length,
            sinRuta: tiendas.filter((tienda) => tienda.ruta === SIN_RUTA).length,
            hojasOmitidas,
            sinCodigo: tiendas.filter((tienda) => tienda.sinCodigo).length,
          };
        })().finally(() => {
          pendingSync = null;
          set({ isSyncing: false });
        });

        return pendingSync;
      },

      addOrderItem: (tienda, producto, cantidad = 1) => {
        if (!producto || !Number.isFinite(cantidad) || cantidad <= 0) return;
        const { pedidos, rutaActiva } = get();
        const actual =
          pedidos[tienda.codigo]?.items.find((item) => item.producto === producto)?.cantidad ?? 0;
        const next = withQuantity(pedidos, tienda, producto, actual + cantidad);
        set({ pedidos: next, rutaActiva: withAtendida(rutaActiva, tienda, pedidos, next) });
      },

      setOrderItemQuantity: (tienda, producto, cantidad) => {
        if (!producto || !Number.isFinite(cantidad)) return;
        const { pedidos, rutaActiva } = get();
        const next = withQuantity(pedidos, tienda, producto, cantidad);
        set({ pedidos: next, rutaActiva: withAtendida(rutaActiva, tienda, pedidos, next) });
      },

      removeOrderItem: (codigoTienda, producto) => {
        const { pedidos, rutaActiva } = get();
        const pedido = pedidos[codigoTienda];
        if (!pedido) return;
        const next = withQuantity(pedidos, pedido.tienda, producto, 0);
        set({ pedidos: next, rutaActiva: withAtendida(rutaActiva, pedido.tienda, pedidos, next) });
      },

      saveOrder: (tienda, items) => {
        const valid = items.filter(
          (item) => item.producto && Number.isFinite(item.cantidad) && item.cantidad > 0,
        );
        const { pedidos: antes, rutaActiva } = get();
        // Guardar sin cambios no debe quitarle la marca de enviado a un pedido que ya se mandó.
        const previo = antes[tienda.codigo];
        if (previo && sameItems(previo.items, valid)) return;
        const pedidos = { ...antes };
        if (valid.length > 0) {
          pedidos[tienda.codigo] = { tienda, items: valid, updatedAt: Date.now() };
        } else {
          delete pedidos[tienda.codigo];
        }
        set({ pedidos, rutaActiva: withAtendida(rutaActiva, tienda, antes, pedidos) });
      },

      clearOrders: (codigoTienda) => {
        if (codigoTienda === undefined) {
          set({ pedidos: {} });
          return;
        }
        const pedidos = { ...get().pedidos };
        delete pedidos[codigoTienda];
        set({ pedidos });
      },

      iniciarRuta: (nombre) => {
        const { rutaActiva, pedidos } = get();
        if (rutaActiva?.nombre === nombre) return; // ya está en curso: no se reinicia
        // Jornada nueva. Lo que ya tenga pedido pendiente en esta ruta cuenta como atendido.
        const atendidas = Object.values(pedidos)
          .filter((pedido) => pedido.tienda.ruta === nombre)
          .map((pedido) => pedido.tienda.codigo);
        set({ rutaActiva: { nombre, iniciadaEn: Date.now(), atendidas, sinPedido: [] } });
      },

      marcarSinPedido: (codigoTienda) => {
        const { rutaActiva, pedidos } = get();
        if (!rutaActiva) return;
        const sinPedido = rutaActiva.sinPedido ?? [];
        // Si ya tiene pedido cuenta como atendida; si no, queda visitada sin pedido.
        if (sinPedido.includes(codigoTienda) || pedidos[codigoTienda]) return;
        set({ rutaActiva: { ...rutaActiva, sinPedido: [...sinPedido, codigoTienda] } });
      },

      quitarSinPedido: (codigoTienda) => {
        const { rutaActiva } = get();
        if (!rutaActiva?.sinPedido?.includes(codigoTienda)) return;
        set({ rutaActiva: { ...rutaActiva, sinPedido: rutaActiva.sinPedido.filter((c) => c !== codigoTienda) } });
      },

      marcarEnviados: (codigos) => {
        const { pedidos } = get();
        const ahora = Date.now();
        const next = { ...pedidos };
        for (const codigo of codigos) if (next[codigo]) next[codigo] = { ...next[codigo], enviadoEn: ahora };
        set({ pedidos: next });
      },

      marcarPendiente: (codigo) => {
        const { pedidos } = get();
        const pedido = pedidos[codigo];
        if (!pedido?.enviadoEn) return;
        const { enviadoEn: _quitado, ...resto } = pedido;
        set({ pedidos: { ...pedidos, [codigo]: resto } });
      },

      finalizarRuta: () => {
        const { rutaActiva, pedidos } = get();
        if (!rutaActiva) return null;
        // Nada de la ruta se conserva: ni el avance ni los pedidos. La próxima vez que se inicie arranca de cero.
        const borrar = new Set(pedidosDeRuta(pedidos, rutaActiva.nombre).map((pedido) => pedido.tienda.codigo));
        const restantes = Object.fromEntries(Object.entries(pedidos).filter(([codigo]) => !borrar.has(codigo)));
        set({ rutaActiva: null, pedidos: restantes });
        return { ...rutaActiva, finalizadaEn: Date.now(), pedidosBorrados: borrar.size };
      },
    }),
    {
      name: 'libreta-pedidos', // clave en AsyncStorage
      version: PERSIST_VERSION,
      migrate: (persisted, version) => migratePersistedState(persisted, version) as unknown as PersistedState,
      storage: createJSONStorage(() => AsyncStorage),
      // Solo datos: isSyncing y hasHydrated describen la sesión actual. Si isSyncing se
      // guardara y la app muriera a mitad de una descarga, arrancaría "sincronizando" para siempre.
      partialize: ({
        rutas,
        tiendas,
        productos,
        pedidos,
        lastSyncAt,
        rutaActiva,
      }): PersistedState => ({
        rutas,
        tiendas,
        productos,
        pedidos,
        lastSyncAt,
        rutaActiva,
      }),
      // Se marca también si la lectura falla, para que la app no quede esperando para siempre.
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.warn('No se pudo cargar el estado guardado', error);
        useStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Mismos productos con las mismas cantidades, en cualquier orden. */
function sameItems(a: readonly OrderItem[], b: readonly OrderItem[]): boolean {
  return a.length === b.length && a.every((item) => b.some((o) => o.producto === item.producto && o.cantidad === item.cantidad));
}

/**
 * Devuelve una copia de `pedidos` con la cantidad del producto actualizada en el pedido de la
 * tienda. `cantidad <= 0` quita el ítem, y si el pedido queda vacío lo elimina del mapa.
 */
function withQuantity(
  pedidos: OrdersByStore,
  tienda: Store,
  producto: ProductName,
  cantidad: number,
): OrdersByStore {
  const items = pedidos[tienda.codigo]?.items ?? [];
  let nextItems: OrderItem[];
  if (cantidad <= 0) {
    nextItems = items.filter((item) => item.producto !== producto);
  } else if (items.some((item) => item.producto === producto)) {
    nextItems = items.map((item) => (item.producto === producto ? { ...item, cantidad } : item));
  } else {
    nextItems = [...items, { producto, cantidad }];
  }

  const next = { ...pedidos };
  if (nextItems.length > 0) {
    next[tienda.codigo] = { tienda, items: nextItems, updatedAt: Date.now() };
  } else {
    delete next[tienda.codigo];
  }
  return next;
}

/**
 * Avance de la ruta en curso después de cambiar el pedido de `tienda`: la marca como atendida si
 * quedó con pedido, y la desmarca si se borró un pedido que estaba pendiente. Las tiendas de otras
 * rutas no cuentan. Enviar los pedidos (`clearOrders`) no pasa por aquí: el avance se conserva.
 */
function withAtendida(
  ruta: RutaActiva | null,
  tienda: Store,
  antes: OrdersByStore,
  despues: OrdersByStore,
): RutaActiva | null {
  if (!ruta || tienda.ruta !== ruta.nombre) return ruta;
  const marcada = ruta.atendidas.includes(tienda.codigo);
  const sinPedido = ruta.sinPedido ?? [];
  if (despues[tienda.codigo]) {
    // Con pedido: atendida, y ya no es "sin pedido"
    if (marcada && !sinPedido.includes(tienda.codigo)) return ruta;
    return {
      ...ruta,
      atendidas: marcada ? ruta.atendidas : [...ruta.atendidas, tienda.codigo],
      sinPedido: sinPedido.filter((codigo) => codigo !== tienda.codigo),
    };
  }
  if (antes[tienda.codigo] && marcada) {
    return { ...ruta, atendidas: ruta.atendidas.filter((codigo) => codigo !== tienda.codigo) };
  }
  return ruta;
}
