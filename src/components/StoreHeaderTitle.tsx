import { Text, View } from 'react-native';

import { displayCodigo } from '@/lib/manualStore';
import type { Store } from '@/types';

/** Título de dos líneas para el header: nombre de la tienda y, debajo, código y ruta. */
export function StoreHeaderTitle({ tienda }: { tienda: Store }) {
  const detalle = tienda.manual
    ? `${displayCodigo(tienda)} · Tienda nueva`
    : [tienda.alias, displayCodigo(tienda), tienda.ruta].filter(Boolean).join(' · ');

  return (
    <View className="shrink">
      <Text className="text-lg font-bold text-white" numberOfLines={1}>
        {tienda.nombre}
      </Text>
      <Text className="text-sm font-medium text-brand-200" numberOfLines={1}>
        {detalle}
      </Text>
    </View>
  );
}
