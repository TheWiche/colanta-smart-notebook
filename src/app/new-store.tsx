import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { ArrowRight, ChevronRight, Info, Sparkles, Store } from '@/lib/icons';
import { cleanStoreName, displayCodigo, isValidStoreName, newManualStoreId } from '@/lib/manualStore';
import { buildStoreIndex, search } from '@/lib/search';
import { useStore } from '@/store/useStore';
import colors from '@/theme/colors';
import type { Store as StoreType } from '@/types';

const MAX_SUGGESTIONS = 5;

/**
 * Pide solo el nombre y pasa directo a tomar el pedido. La tienda no se guarda sola: existe cuando se guarda
 * el pedido. Mientras se escribe, sugiere tiendas parecidas (de cualquier ruta) para no duplicar una que ya existe.
 */
export default function NewStoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { ruta, nombre: sugerido } = useLocalSearchParams<{ ruta?: string; nombre?: string }>();
  const tiendas = useStore((s) => s.tiendas);
  const pedidos = useStore((s) => s.pedidos);
  const [nombre, setNombre] = useState(sugerido ?? '');

  const valido = isValidStoreName(nombre);

  // Tiendas que se pueden sugerir: las nuevas (viven en su pedido) y las del catálogo, cada una una sola vez.
  const indice = useMemo(() => {
    const nuevas = Object.values(pedidos)
      .filter((pedido) => pedido.tienda.manual)
      .map((pedido) => pedido.tienda);
    const vistas = new Set<string>();
    const candidatas = [...nuevas, ...tiendas].filter((t) => {
      if (vistas.has(t.codigo)) return false; // una tienda puede estar en varias rutas
      vistas.add(t.codigo);
      return true;
    });
    return buildStoreIndex(candidatas);
  }, [tiendas, pedidos]);

  // Palabra por palabra en nombre y código: primero las que tienen todas las palabras.
  const sugerencias = useMemo(() => {
    const { palabras, todas, algunas } = search(indice, nombre);
    return palabras.length === 0 ? [] : [...todas, ...algunas].slice(0, MAX_SUGGESTIONS);
  }, [indice, nombre]);

  const crear = () => {
    if (!valido) return;
    router.replace({
      pathname: '/order/[codigo]',
      params: { codigo: newManualStoreId(), nuevo: cleanStoreName(nombre), ruta: ruta ?? '' },
    });
  };

  const abrir = (tienda: StoreType) =>
    router.replace({ pathname: '/order/[codigo]', params: { codigo: tienda.codigo } });

  return (
    <View className="flex-1 bg-slate-50" style={{ paddingBottom: keyboardHeight }}>
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 p-4">
        <View className="flex-row items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <Info size={24} color={colors.brand.DEFAULT} strokeWidth={2.4} />
          <Text className="flex-1 text-base font-medium text-brand-800">
            ¿Tienda nueva o sin código? Escribe solo el nombre y toma el pedido. En WhatsApp saldrá como SIN
            CÓDIGO para que se sepa que es nueva.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-lg font-bold text-slate-900">Nombre de la tienda</Text>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            onSubmitEditing={crear}
            autoFocus
            maxLength={60}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="go"
            placeholder="Ej: Tienda La Esquina"
            placeholderTextColor={colors.slate[500]}
            selectionColor={colors.brand.DEFAULT}
            className="h-14 rounded-xl border-2 border-slate-200 bg-white px-4 text-lg text-slate-900 shadow-sm focus:border-brand"
            accessibilityLabel="Nombre de la tienda"
          />
        </View>

        {sugerencias.length > 0 && (
          <View className="gap-3">
            <View className="gap-0.5">
              <Text className="text-lg font-bold text-slate-900">¿Es una de estas?</Text>
              <Text className="text-base text-slate-600">
                Si ya existe, ábrela y el pedido saldrá con su código.
              </Text>
            </View>
            {sugerencias.map((tienda) => (
              <Pressable
                key={tienda.codigo}
                accessibilityRole="button"
                onPress={() => abrir(tienda)}
                className="min-h-20 flex-row items-center gap-4 rounded-xl border border-slate-200 bg-milk p-4 shadow-sm active:bg-brand-50"
              >
                <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <Store size={24} color={colors.brand.DEFAULT} strokeWidth={2.2} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-bold text-slate-900" numberOfLines={2}>
                    {tienda.nombre}
                  </Text>
                  <Text className="text-base font-medium text-slate-600" numberOfLines={1}>
                    {[tienda.alias, displayCodigo(tienda), tienda.ruta].filter(Boolean).join(' · ')}
                  </Text>
                  {tienda.manual && <Badge tone="brand" icon={Sparkles} label="Tienda nueva" />}
                </View>
                <ChevronRight size={26} color={colors.slate[400]} strokeWidth={2.5} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View
        className="border-t border-slate-200 bg-white px-4 pt-3"
        style={{ paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12) }}
      >
        <Button label="Tomar pedido" icon={ArrowRight} size="lg" disabled={!valido} onPress={crear} />
      </View>
    </View>
  );
}
