import { Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import type { CatalogSection } from '@/lib/catalog';
import { Check } from '@/lib/icons';

interface CatalogSectionHeaderProps {
  section: CatalogSection;
  /** Productos de esta sección que ya van en el pedido. */
  enPedido: number;
}

/** Encabezado fijo de un grupo de la lista ("Frecuentes", "Coinciden todas las palabras"…). Las listas planas no dibujan nada. */
export function CatalogSectionHeader({ section, enPedido }: CatalogSectionHeaderProps) {
  if (!section.titulo) return null;
  return (
    <View
      accessibilityRole="header"
      className="min-h-12 flex-row items-center gap-3 border-y border-slate-200 bg-slate-100 px-4"
    >
      <Text className="flex-1 text-base font-extrabold text-slate-900" numberOfLines={1}>
        {section.titulo}
      </Text>
      {enPedido > 0 && <Badge tone="success" icon={Check} label={`${enPedido} en pedido`} />}
      <View className="min-w-8 items-center rounded-full border border-slate-200 bg-white px-2 py-0.5">
        <Text className="text-sm font-bold text-slate-600">{section.total}</Text>
      </View>
    </View>
  );
}
