/** Tienda (punto de venta). Fila del CSV de tiendas: `ruta,codigo,nombre`. */
export interface Store {
  ruta: string;
  /**
   * Identificador único de la tienda en la app y llave de `OrdersByStore`.
   * Tiendas del catálogo: el código real de la hoja. Tiendas manuales: un id generado (`manual-…`).
   */
  codigo: string;
  nombre: string;
  /**
   * Tienda creada en la calle que todavía no está en la hoja. No tiene código real (sale como
   * "SIN CÓDIGO" en el mensaje) y solo existe mientras tenga un pedido guardado.
   */
  manual?: boolean;
  /**
   * La hoja trae la tienda sin código todavía. `codigo` es un id generado (`sc-…`) para poder tomarle pedido, y en el
   * mensaje sale como "SIN CÓDIGO". Si luego la hoja le pone código, pasa a ser otra tienda para la app.
   */
  sinCodigo?: boolean;
  /** Nombre secundario (columna opcional de la hoja): como la conocen en la calle si difiere del de la hoja. */
  alias?: string;
}

/** Cómo aparece el producto en las dos hojas: el catálogo oficial y la "Hoja 1" de los nombres comerciales. */
export type EstadoCoincidencia = 'Coincide en ambas' | 'Solo en Hoja 1' | 'Solo en Catálogo';

/** Producto del catálogo: una fila de la hoja de productos. */
export interface Product {
  /**
   * Nombre con el que se pide: el alias si lo tiene y, si no, el nombre de catálogo. Es lo que se muestra grande, lo
   * que se guarda en el pedido y lo que sale en WhatsApp (llave del ítem del pedido).
   */
  nombre: string;
  /** Código de la hoja (texto: conserva los ceros a la izquierda). Vacío si el producto no lo trae. */
  codigo: string;
  /** Nombre técnico/oficial del catálogo. Si la fila solo está en la Hoja 1 (sin nombre de catálogo), repite el alias. */
  nombreCatalogo: string;
  /** Nombre comercial corto de los productos de rotación común. Vacío si no tiene. */
  alias: string;
  estado: EstadoCoincidencia;
}

/** Nombre de un producto: la llave con la que se guarda en el pedido y se muestra en WhatsApp. */
export type ProductName = string;

export interface OrderItem {
  producto: ProductName;
  cantidad: number;
}

/**
 * Pedido en borrador de una tienda. Guarda una copia de la tienda para que el
 * pedido siga siendo legible aunque la tienda cambie o salga del catálogo.
 */
export interface Order {
  tienda: Store;
  items: OrderItem[];
  /** Epoch ms del último cambio. */
  updatedAt: number;
  /**
   * Epoch ms en que se abrió WhatsApp con este pedido; ausente = sin enviar. Cualquier cambio al pedido lo quita:
   * lo que ya se mandó no incluye lo nuevo.
   */
  enviadoEn?: number;
}

/** Pedidos pendientes indexados por `Store.codigo`. Objeto plano (no `Map`) para que serialice a JSON. */
export type OrdersByStore = Record<Store['codigo'], Order>;

/** Ruta que el preventista está recorriendo. Se guarda para sobrevivir a cierres de la app. */
export interface RutaActiva {
  nombre: string;
  /** Epoch ms en que se inició. */
  iniciadaEn: number;
  /**
   * Códigos de las tiendas de la ruta que quedaron con pedido. Enviar los pedidos no los borra,
   * así el avance se conserva hasta finalizar la ruta.
   */
  atendidas: string[];
  /** Códigos de las tiendas que se visitaron y no pidieron nada ("sin pedido hoy"): cuentan para el avance. */
  sinPedido: string[];
}

/** Ruta finalizada hoy: se muestra como "Concluida" y se puede retomar con su avance. */
export interface RutaConcluida extends RutaActiva {
  /** Epoch ms en que se finalizó. */
  finalizadaEn: number;
  /** Pedidos de la ruta que se borraron al finalizar. */
  pedidosBorrados: number;
}

/** Conteos que devuelve `syncData`, útiles para mostrar un resumen. */
export interface SyncSummary {
  rutas: number;
  tiendas: number;
  productos: number;
  /** Tiendas que la hoja trajo sin ruta (quedaron en "Sin ruta"). Sirve para avisar que hay que corregir la hoja. */
  sinRuta: number;
  /** Hojas (rutas) del documento de tiendas que no aportaron tiendas: vacías o sin columnas Código/Nombre. */
  hojasOmitidas: string[];
  /** Tiendas que la hoja trajo sin código: se pueden visitar y salen como "SIN CÓDIGO" en el mensaje. */
  sinCodigo: number;
}
