import { Stack, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, SectionList, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { CatalogSectionHeader } from '@/components/CatalogSectionHeader';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { ProductRow } from '@/components/ProductRow';
import { QuantityModal } from '@/components/QuantityModal';
import { SearchInput } from '@/components/SearchInput';
import { StoreHeaderTitle } from '@/components/StoreHeaderTitle';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { buildSearchIndex, buildSections, searchProducts } from '@/lib/catalog';
import type { CatalogSection } from '@/lib/catalog';
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Minus,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  SearchX,
  ShoppingCart,
  Store,
  Trash,
} from '@/lib/icons';
import { createManualStore } from '@/lib/manualStore';
import { toQuantity } from '@/lib/quantity';
import { useStore } from '@/store/useStore';
import colors from '@/theme/colors';
import type { OrderItem, ProductName } from '@/types';

const EMPTY: OrderItem[] = [];

export default function OrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const keyboardVisible = keyboardHeight > 0;
  // `nuevo` (nombre) y `ruta` solo llegan al crear una tienda manual: hasta guardar el pedido, la tienda es un borrador.
  const { codigo, nuevo, ruta: rutaParam } = useLocalSearchParams<{ codigo: string; nuevo?: string; ruta?: string }>();
  const productos = useStore((s) => s.productos);
  const saved = useStore((s) => s.pedidos[codigo]?.items ?? EMPTY);
  const savedTienda = useStore((s) => s.pedidos[codigo]?.tienda);
  const catalogTienda = useStore((s) => s.tiendas.find((t) => t.codigo === codigo));
  const saveOrder = useStore((s) => s.saveOrder);
  const rutaActiva = useStore((s) => s.rutaActiva);
  const marcarSinPedido = useStore((s) => s.marcarSinPedido);
  const quitarSinPedido = useStore((s) => s.quitarSinPedido);
  const draftTienda = useMemo(
    () => (nuevo ? createManualStore(codigo, nuevo, rutaParam ?? '') : undefined),
    [codigo, nuevo, rutaParam],
  );
  // Catálogo si la tienda sigue ahí; si no, la copia guardada en el pedido; si es nueva, el borrador.
  const tienda = catalogTienda ?? savedTienda ?? draftTienda;

  // Carrito local: solo llega a Zustand al tocar "Guardar". Si la tienda ya tenía un pedido, arranca con sus ítems.
  const [cart, setCart] = useState<OrderItem[]>(saved);
  // Cantidad escrita en cada fila de producto (texto, para permitir el input vacío al editar).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  // Detalle del pedido desplegado en el footer. Con un pedido ya guardado arranca abierto: se ve lo que hay y se edita.
  const [detailOpen, setDetailOpen] = useState(saved.length > 0);
  // Edición de una línea del pedido: cantidad con teclado, tipo (pedido/cambio) y confirmación al quitarla.
  const [editando, setEditando] = useState<OrderItem | null>(null);
  const [porQuitar, setPorQuitar] = useState<OrderItem | null>(null);

  const hasChanges = JSON.stringify(cart) !== JSON.stringify(saved);

  // Salir con cambios sin guardar: se pregunta con un diálogo de la app. `salida` guarda cómo continuar si confirma.
  const [salida, setSalida] = useState<(() => void) | null>(null);
  const disablePrevention = usePreventRemove(hasChanges, ({ repeat }) => setSalida(() => repeat));

  // --- Catálogo: índice, búsqueda y secciones (todo derivado de `productos`) ---
  const indice = useMemo(() => buildSearchIndex(productos), [productos]);
  // Palabra por palabra, en alias, nombre de catálogo y código; los productos con alias primero.
  const busqueda = useMemo(() => searchProducts(indice, query), [indice, query]);
  const sections = useMemo(() => buildSections(busqueda), [busqueda]);

  const enCarrito = useMemo(
    () =>
      cart
        .filter((item) => !item.esCambio)
        .reduce((acc, item) => ({ ...acc, [item.producto]: (acc[item.producto] ?? 0) + item.cantidad }), {} as Record<ProductName, number>),
    [cart],
  );

  const enCambio = useMemo(
    () =>
      cart
        .filter((item) => item.esCambio)
        .reduce((acc, item) => ({ ...acc, [item.producto]: (acc[item.producto] ?? 0) + item.cantidad }), {} as Record<ProductName, number>),
    [cart],
  );

  const setDraft = useCallback((producto: ProductName, text: string) => {
    setDrafts((prev) => ({ ...prev, [producto]: text.replace(/\D/g, '') }));
  }, []);

  const stepDraft = useCallback((producto: ProductName, delta: number) => {
    setDrafts((prev) => {
      const next = Math.max(1, toQuantity(prev[producto] ?? '1') + delta);
      return { ...prev, [producto]: String(next) };
    });
  }, []);

  const addToCart = useCallback((producto: ProductName, cantidad: number, esCambio = false) => {
    if (cantidad <= 0) return;
    setCart((prev) => {
      const match = (item: OrderItem) =>
        item.producto === producto && Boolean(item.esCambio) === Boolean(esCambio);
      if (prev.some(match)) {
        return prev.map((item) =>
          match(item) ? { ...item, cantidad: item.cantidad + cantidad } : item,
        );
      }
      return [...prev, { producto, cantidad, ...(esCambio ? { esCambio: true } : {}) }];
    });
    setDrafts((prev) => ({ ...prev, [producto]: '1' }));
  }, []);

  const updateCartItem = (
    original: OrderItem,
    newCantidad: number,
    newEsCambio: boolean = Boolean(original.esCambio),
  ) => {
    setCart((prev) => {
      const isOriginal = (it: OrderItem) =>
        it.producto === original.producto && Boolean(it.esCambio) === Boolean(original.esCambio);

      if (newCantidad <= 0) {
        return prev.filter((it) => !isOriginal(it));
      }

      if (Boolean(original.esCambio) === newEsCambio) {
        return prev.map((it) => (isOriginal(it) ? { ...it, cantidad: newCantidad } : it));
      }

      const withoutOriginal = prev.filter((it) => !isOriginal(it));
      const targetMatch = (it: OrderItem) =>
        it.producto === original.producto && Boolean(it.esCambio) === newEsCambio;

      if (withoutOriginal.some(targetMatch)) {
        return withoutOriginal.map((it) =>
          targetMatch(it) ? { ...it, cantidad: it.cantidad + newCantidad } : it,
        );
      }

      return [
        ...withoutOriginal,
        { producto: original.producto, cantidad: newCantidad, ...(newEsCambio ? { esCambio: true } : {}) },
      ];
    });
  };

  const removeFromCart = (itemToRemove: OrderItem) => {
    setCart((prev) =>
      prev.filter(
        (it) =>
          !(it.producto === itemToRemove.producto && Boolean(it.esCambio) === Boolean(itemToRemove.esCambio)),
      ),
    );
  };

  /** "−" en una línea: baja uno; si llegaría a 0 pide confirmación antes de quitarla. */
  const stepItem = (item: OrderItem, delta: number) => {
    if (item.cantidad + delta <= 0) {
      setPorQuitar(item);
    } else {
      updateCartItem(item, item.cantidad + delta);
    }
  };

  // Al abrirse el teclado la lista se encoge: la fila que se está editando se lleva a la zona visible.
  const listRef = useRef<SectionList<CatalogSection['data'][number], CatalogSection>>(null);
  const sectionsRef = useRef(sections);
  const focusedRef = useRef<string | null>(null);
  const keyboardOpenRef = useRef(false);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  // Cambiar de búsqueda empieza la lista desde arriba.
  useEffect(() => {
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  }, [query]);

  useEffect(() => {
    keyboardOpenRef.current = keyboardVisible;
    if (!keyboardVisible) focusedRef.current = null;
    else if (focusedRef.current) scrollToRow(listRef.current, sectionsRef.current, focusedRef.current);
  }, [keyboardVisible]);

  const onFocusRow = useCallback((rowKey: string) => {
    focusedRef.current = rowKey;
    // Con el teclado ya abierto (cambio de fila) no habrá otro evento que dispare el scroll.
    if (keyboardOpenRef.current) scrollToRow(listRef.current, sectionsRef.current, rowKey);
  }, []);

  const onSave = () => {
    if (!tienda) return;
    saveOrder(tienda, cart);
    disablePrevention();
    router.back();
  };

  if (!tienda) {
    return (
      <View className="flex-1 justify-center bg-slate-50">
        <Stack.Screen options={{ title: 'Pedido' }} />
        <EmptyState
          icon={Store}
          title="Tienda no encontrada"
          message={`No existe la tienda ${codigo}. Sincroniza el catálogo.`}
        />
      </View>
    );
  }

  const regularItems = cart.filter((item) => !item.esCambio);
  const cambioItems = cart.filter((item) => item.esCambio);
  const unidadesCobro = regularItems.reduce((sum, item) => sum + item.cantidad, 0);
  const unidadesCambio = cambioItems.reduce((sum, item) => sum + item.cantidad, 0);
  const showDetail = detailOpen && cart.length > 0;
  const saveLabel = hasChanges
    ? 'Guardar Pedido de Tienda'
    : saved.length > 0
      ? 'Pedido guardado'
      : 'Guardar Pedido de Tienda';

  // "Sin pedido hoy": solo con la ruta de esta tienda en curso y mientras no tenga pedido.
  const enRuta = rutaActiva !== null && rutaActiva.nombre === tienda.ruta && !tienda.manual;
  const marcadaSinPedido = enRuta && (rutaActiva?.sinPedido ?? []).includes(tienda.codigo);
  const puedeMarcarSinPedido = enRuta && cart.length === 0 && saved.length === 0;

  const empty =
    productos.length === 0 ? (
      <EmptyState icon={PackagePlus} title="Sin productos" message="No hay productos. Sincroniza el catálogo." />
    ) : (
      <EmptyState icon={SearchX} title="Sin resultados" message="Ningún producto coincide con la búsqueda." />
    );

  return (
    // El padding reserva el espacio del teclado; el footer se oculta mientras se teclea para dar sitio a la lista.
    <View className="flex-1 bg-slate-50" style={{ paddingBottom: keyboardHeight }}>
      <Stack.Screen
        options={{ title: tienda.nombre, headerTitle: () => <StoreHeaderTitle tienda={tienda} /> }}
      />

      <View className="px-4 pt-3">
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre, alias o código"
          accessibilityLabel="Buscar producto"
        />
      </View>

      <SectionList<CatalogSection['data'][number], CatalogSection>
        ref={listRef}
        className="mt-2 flex-1"
        sections={sections}
        keyExtractor={(row) => row.key}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollToIndexFailed={() => {}}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListEmptyComponent={empty}
        ListFooterComponent={<View className="h-4" />}
        renderSectionHeader={({ section }) => (
          <CatalogSectionHeader
            section={section}
            enPedido={section.nombres.reduce(
              (n, nombre) => n + ((enCarrito[nombre] ?? 0) > 0 || (enCambio[nombre] ?? 0) > 0 ? 1 : 0),
              0,
            )}
          />
        )}
        renderItem={({ item }) => (
          <View className="px-4 pt-3">
            <ProductRow
              product={item.product}
              rowKey={item.key}
              draft={drafts[item.product.nombre] ?? '1'}
              enCarrito={enCarrito[item.product.nombre] ?? 0}
              enCambio={enCambio[item.product.nombre] ?? 0}
              onChangeDraft={setDraft}
              onStep={stepDraft}
              onAdd={(prod, cant) => addToCart(prod, cant, false)}
              onAddCambio={(prod, cant) => addToCart(prod, cant, true)}
              onFocusRow={onFocusRow}
            />
          </View>
        )}
      />

      {/* Footer anclado: resumen del pedido (editable) + guardar */}
      {!keyboardVisible && (
        <View
          className="rounded-t-3xl border-t border-slate-200 bg-white px-4 pt-4 shadow-[0_-8px_20px_rgba(15,23,42,0.18)]"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={detailOpen ? 'Ocultar detalle del pedido' : 'Ver y editar el pedido'}
            disabled={cart.length === 0}
            onPress={() => setDetailOpen((open) => !open)}
            className="flex-row items-center gap-3"
          >
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
              <ShoppingCart size={24} color={colors.brand.DEFAULT} strokeWidth={2.2} />
              {cart.length > 0 && (
                <View className="absolute -right-2 -top-2 min-w-6 items-center rounded-full border-2 border-white bg-accent px-1.5">
                  <Text className="text-xs font-extrabold text-white">{cart.length}</Text>
                </View>
              )}
            </View>
            <View className="flex-1">
              {cart.length === 0 ? (
                <>
                  <Text className="text-lg font-extrabold text-slate-900">
                    {marcadaSinPedido ? 'Sin pedido hoy' : 'Pedido vacío'}
                  </Text>
                  <Text className="text-base text-slate-600">
                    {marcadaSinPedido ? 'La tienda ya cuenta como gestionada' : 'Agrega productos de la lista'}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-lg font-extrabold text-slate-900">
                    {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
                    {unidadesCambio > 0 ? ` (${regularItems.length} reg. · ${cambioItems.length} camb.)` : ''}
                  </Text>
                  <Text className="text-base text-slate-600">
                    {unidadesCobro} {unidadesCobro === 1 ? 'unidad a cobrar' : 'unidades a cobrar'}
                    {unidadesCambio > 0 ? ` · ${unidadesCambio} ${unidadesCambio === 1 ? 'cambio' : 'cambios'}` : ''}
                  </Text>
                </>
              )}
            </View>
            {cart.length > 0 &&
              (detailOpen ? (
                <ChevronDown size={26} color={colors.slate[500]} strokeWidth={2.5} />
              ) : (
                <ChevronUp size={26} color={colors.slate[500]} strokeWidth={2.5} />
              ))}
          </Pressable>

          {showDetail && (
            <ScrollView
              className="mt-2"
              style={{ maxHeight: Math.round(height * 0.34) }}
              keyboardShouldPersistTaps="handled"
            >
              {cart.map((item) => {
                const itemKey = `${item.producto}-${item.esCambio ? 'cambio' : 'normal'}`;
                return (
                  <View key={itemKey} className="gap-2 border-b border-slate-100 py-2.5">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-base font-semibold text-slate-800" numberOfLines={2}>
                        {item.producto}
                      </Text>
                      {item.esCambio ? (
                        <Badge tone="warning" icon={RefreshCw} label="Cambio (Vencido)" />
                      ) : (
                        <Badge tone="neutral" label="Pedido normal" />
                      )}
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Restar uno a ${item.producto}`}
                        onPress={() => stepItem(item, -1)}
                        className="h-12 w-12 items-center justify-center rounded-xl border-2 border-slate-300 bg-white active:bg-slate-100"
                      >
                        <Minus size={22} color={colors.slate[700]} strokeWidth={3} />
                      </Pressable>
                      {/* Tocar el número abre el teclado numérico para escribir la cantidad y alternar cambio/pedido */}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Cantidad de ${item.producto}: ${item.cantidad}. Tocar para editar`}
                        onPress={() => setEditando(item)}
                        className={`h-12 min-w-16 items-center justify-center rounded-xl border-2 px-3 ${
                          item.esCambio
                            ? 'border-amber-300 bg-amber-50 active:bg-amber-100'
                            : 'border-brand-200 bg-brand-50 active:bg-brand-100'
                        }`}
                      >
                        <Text className={`text-xl font-extrabold ${item.esCambio ? 'text-amber-800' : 'text-brand-700'}`}>
                          {item.cantidad}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Sumar uno a ${item.producto}`}
                        onPress={() => stepItem(item, 1)}
                        className={`h-12 w-12 items-center justify-center rounded-xl border-2 ${
                          item.esCambio
                            ? 'border-amber-300 bg-amber-50 active:bg-amber-100'
                            : 'border-brand-200 bg-brand-50 active:bg-brand-100'
                        }`}
                      >
                        <Plus size={22} color={item.esCambio ? colors.amber[700] : colors.brand.DEFAULT} strokeWidth={3} />
                      </Pressable>
                      <View className="flex-1" />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar ${item.producto}`}
                        onPress={() => setPorQuitar(item)}
                        className="h-12 w-12 items-center justify-center rounded-xl bg-accent-50 active:bg-accent-100"
                      >
                        <Trash size={20} color={colors.accent.DEFAULT} strokeWidth={2.4} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {(puedeMarcarSinPedido || marcadaSinPedido) && cart.length === 0 && (
            <View className="mt-3">
              <Button
                variant="secondary"
                icon={marcadaSinPedido ? Trash : CircleCheck}
                label={marcadaSinPedido ? 'Quitar «sin pedido hoy»' : 'Marcar sin pedido hoy'}
                onPress={() => {
                  if (marcadaSinPedido) quitarSinPedido(tienda.codigo);
                  else {
                    marcarSinPedido(tienda.codigo);
                    disablePrevention();
                    router.back();
                  }
                }}
              />
            </View>
          )}

          <View className="mt-3">
            <Button
              variant={!hasChanges && saved.length > 0 ? 'saved' : 'primary'}
              size="lg"
              icon={!hasChanges && saved.length > 0 ? CircleCheck : Save}
              label={saveLabel}
              disabled={!hasChanges}
              onPress={onSave}
            />
          </View>
        </View>
      )}

      <QuantityModal
        key={editando ? `${editando.producto}-${editando.esCambio ? 'c' : 'n'}` : 'cerrado'}
        producto={editando?.producto ?? null}
        cantidad={editando?.cantidad ?? 1}
        esCambio={editando?.esCambio ?? false}
        onConfirm={(cantidad, esCambio) => {
          if (editando) updateCartItem(editando, cantidad, esCambio);
          setEditando(null);
        }}
        onRemove={() => {
          if (editando) setPorQuitar(editando);
          setEditando(null);
        }}
        onClose={() => setEditando(null)}
      />
      <Dialog
        visible={porQuitar !== null}
        tone="danger"
        icon={Trash}
        title="¿Quitar del pedido?"
        message={
          porQuitar
            ? `${porQuitar.producto}${porQuitar.esCambio ? ' [Cambio por vencimiento]' : ''}`
            : ''
        }
        actions={[
          { label: 'Dejarlo', variant: 'secondary', onPress: () => setPorQuitar(null) },
          {
            label: 'Quitar',
            variant: 'danger',
            icon: Trash,
            onPress: () => {
              if (porQuitar) removeFromCart(porQuitar);
              setPorQuitar(null);
            },
          },
        ]}
        onClose={() => setPorQuitar(null)}
      />
      <Dialog
        visible={salida !== null}
        tone="warning"
        icon={Save}
        title="¿Salir sin guardar?"
        message="Los cambios de este pedido se perderán."
        actions={[
          { label: 'Seguir editando', variant: 'primary', onPress: () => setSalida(null) },
          {
            label: 'Salir sin guardar',
            variant: 'danger',
            onPress: () => {
              const continuar = salida;
              setSalida(null);
              continuar?.();
            },
          },
        ]}
        onClose={() => setSalida(null)}
      />
    </View>
  );
}

/** Lleva la fila `rowKey` a la zona visible de la lista (debajo del encabezado fijo). */
function scrollToRow(
  list: SectionList<CatalogSection['data'][number], CatalogSection> | null,
  sections: readonly CatalogSection[],
  rowKey: string,
) {
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const dataIndex = sections[sectionIndex].data.findIndex((row) => row.key === rowKey);
    if (dataIndex >= 0) {
      // En `scrollToLocation` el índice 0 es el encabezado de la sección: la fila N de `data` es N + 1.
      list?.scrollToLocation({ sectionIndex, itemIndex: dataIndex + 1, viewPosition: 0.1, animated: true });
      return;
    }
  }
}
