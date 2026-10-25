import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SearchInput } from '@/components/SearchInput';
import { Check, ChevronRight, CircleCheck, CirclePlus, RefreshCw, SearchX, Sparkles, Store } from '@/lib/icons';
import { cleanStoreName, displayCodigo } from '@/lib/manualStore';
import { buildStoreIndex, search } from '@/lib/search';
import { useStore } from '@/store/useStore';
import colors from '@/theme/colors';

export default function StoresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ruta } = useLocalSearchParams<{ ruta: string }>();
  const tiendas = useStore((s) => s.tiendas);
  const pedidos = useStore((s) => s.pedidos);
  const rutaActiva = useStore((s) => s.rutaActiva);
  const marcarSinPedido = useStore((s) => s.marcarSinPedido);
  const quitarSinPedido = useStore((s) => s.quitarSinPedido);
  // "Sin pedido hoy" solo tiene sentido con esta ruta en curso
  const rutaEnCurso = rutaActiva?.nombre === ruta;
  const [query, setQuery] = useState('');

  const delaRuta = useMemo(() => tiendas.filter((t) => t.ruta === ruta), [tiendas, ruta]);

  // Las tiendas nuevas (manuales) viven dentro de su pedido: aparecen primero en la ruta donde se crearon.
  const nuevas = useMemo(
    () =>
      Object.values(pedidos)
        .filter((pedido) => pedido.tienda.manual && pedido.tienda.ruta === ruta)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((pedido) => pedido.tienda),
    [pedidos, ruta],
  );

  // Búsqueda palabra por palabra en nombre y código: primero las que tienen todas las palabras y después las
  // que tienen solo algunas. Dentro de cada grupo se conserva el orden de la ruta (las nuevas primero).
  const indice = useMemo(() => buildStoreIndex([...nuevas, ...delaRuta]), [nuevas, delaRuta]);
  const busqueda = useMemo(() => search(indice, query), [indice, query]);
  const visibles = useMemo(() => [...busqueda.todas, ...busqueda.algunas], [busqueda]);
  // Posición de la primera tienda con solo algunas palabras (-1 si no hay): ahí va el rótulo que las separa.
  const primeraParcial = busqueda.algunas.length > 0 ? busqueda.todas.length : -1;

  const nombreBuscado = cleanStoreName(query);
  const sinResultados = visibles.length === 0 && nombreBuscado !== '';

  const crearTienda = () =>
    router.push({ pathname: '/new-store', params: { ruta, ...(nombreBuscado ? { nombre: nombreBuscado } : {}) } });

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: ruta }} />
      <View className="gap-3 px-4 pt-4">
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre o código"
          accessibilityLabel="Buscar tienda"
        />
        {!sinResultados && (
          <Button label="Tienda no registrada" icon={CirclePlus} variant="secondary" onPress={crearTienda} />
        )}
      </View>
      <FlatList
        data={visibles}
        keyExtractor={(t) => t.codigo}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-3 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          delaRuta.length + nuevas.length > 0 ? (
            <Text className="mb-1 text-lg font-semibold text-slate-600">
              {query
                ? `${visibles.length} de ${delaRuta.length + nuevas.length} tiendas`
                : `${delaRuta.length} ${delaRuta.length === 1 ? 'tienda' : 'tiendas'}${
                    nuevas.length > 0 ? ` · ${nuevas.length} ${nuevas.length === 1 ? 'nueva' : 'nuevas'}` : ''
                  }`}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          query ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              message="Ninguna tienda coincide con la búsqueda. Si es una tienda nueva, tómale el pedido igual."
            >
              <Button
                label={`Agregar «${nombreBuscado}» como tienda nueva`}
                icon={CirclePlus}
                onPress={crearTienda}
              />
            </EmptyState>
          ) : (
            <EmptyState icon={Store} title="Ruta vacía" message="Esta ruta no tiene tiendas." />
          )
        }
        renderItem={({ item: tienda, index }) => {
          const orderItems = pedidos[tienda.codigo]?.items ?? [];
          const items = orderItems.length;
          const conPedido = items > 0;
          const regulares = orderItems.filter((it) => !it.esCambio).length;
          const cambiosCount = orderItems.filter((it) => it.esCambio).length;
          const enviado = !!pedidos[tienda.codigo]?.enviadoEn;
          const nueva = tienda.manual === true;
          const sinPedido = rutaEnCurso && !conPedido && (rutaActiva?.sinPedido ?? []).includes(tienda.codigo);
          const tarjeta = (
            <View
              className={`overflow-hidden rounded-xl border shadow-sm ${
                conPedido ? 'border-emerald-300 bg-emerald-50' : sinPedido ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-milk'
              }`}
            >
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/order/[codigo]', params: { codigo: tienda.codigo } })}
              className="min-h-24 flex-row items-center gap-4 p-4 active:bg-brand-50"
            >
              <View
                className={`h-12 w-12 items-center justify-center rounded-xl ${
                  conPedido ? 'bg-emerald-700' : 'bg-brand-50'
                }`}
              >
                {conPedido ? (
                  <Check size={26} color={colors.white} strokeWidth={3} />
                ) : (
                  <Store size={24} color={colors.brand.DEFAULT} strokeWidth={2.2} />
                )}
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-xl font-bold text-slate-900" numberOfLines={2}>
                  {tienda.nombre}
                </Text>
                {tienda.alias ? (
                  <Text className="text-base font-semibold text-brand-700" numberOfLines={1}>
                    {tienda.alias}
                  </Text>
                ) : null}
                <Text className="text-base font-medium text-slate-600">
                  {nueva || tienda.sinCodigo ? displayCodigo(tienda) : `Código ${tienda.codigo}`}
                </Text>
                {(nueva || conPedido || sinPedido) && (
                  <View className="flex-row flex-wrap gap-2">
                    {nueva && <Badge tone="brand" icon={Sparkles} label="Tienda nueva" />}
                    {sinPedido && <Badge tone="neutral" icon={Check} label="Sin pedido hoy" />}
                    {conPedido && (
                      <Badge
                        tone="success"
                        icon={CircleCheck}
                        label={regulares === 1 ? '1 producto' : `${regulares} productos`}
                      />
                    )}
                    {conPedido && cambiosCount > 0 && (
                      <Badge
                        tone="warning"
                        icon={RefreshCw}
                        label={cambiosCount === 1 ? '1 cambio' : `${cambiosCount} cambios`}
                      />
                    )}
                    {conPedido && enviado && <Badge tone="brand" icon={Check} label="Enviado" />}
                  </View>
                )}
              </View>
              <ChevronRight size={28} color={colors.slate[400]} strokeWidth={2.5} />
            </Pressable>
            {rutaEnCurso && !conPedido && !nueva && (
              <Pressable
                accessibilityRole="button"
                onPress={() => (sinPedido ? quitarSinPedido(tienda.codigo) : marcarSinPedido(tienda.codigo))}
                className="min-h-12 flex-row items-center justify-center gap-2 border-t border-slate-200 px-4 active:bg-slate-200"
              >
                <Check size={20} color={colors.slate[700]} strokeWidth={3} />
                <Text className="text-base font-bold text-slate-700">
                  {sinPedido ? 'Quitar «sin pedido hoy»' : 'Marcar sin pedido hoy'}
                </Text>
              </Pressable>
            )}
            </View>
          );
          if (index !== primeraParcial) return tarjeta;
          return (
            <View className="gap-3">
              <Text className="mt-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">
                Coinciden algunas palabras
              </Text>
              {tarjeta}
            </View>
          );
        }}
      />
    </View>
  );
}
