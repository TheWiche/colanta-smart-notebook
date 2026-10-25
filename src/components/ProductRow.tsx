import type { LucideIcon } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Check, Minus, PackagePlus, Plus, RefreshCw } from '@/lib/icons';
import { toQuantity } from '@/lib/quantity';
import colors from '@/theme/colors';
import type { Product, ProductName } from '@/types';

interface ProductRowProps {
  product: Product;
  /** Llave de la fila en la lista (el mismo producto puede aparecer en dos categorías). */
  rowKey: string;
  draft: string;
  enCarrito: number;
  enCambio?: number;
  onChangeDraft: (producto: ProductName, text: string) => void;
  onStep: (producto: ProductName, delta: number) => void;
  onAdd: (producto: ProductName, cantidad: number) => void;
  onAddCambio?: (producto: ProductName, cantidad: number) => void;
  onFocusRow: (rowKey: string) => void;
}

// memo: al escribir en una fila solo se vuelve a pintar esa fila.
export const ProductRow = memo(function ProductRow({
  product,
  rowKey,
  draft,
  enCarrito,
  enCambio = 0,
  onChangeDraft,
  onStep,
  onAdd,
  onAddCambio,
  onFocusRow,
}: ProductRowProps) {
  const { nombre, codigo, nombreCatalogo, alias } = product;
  // Grande: el alias (o, sin alias, el nombre de catálogo). Atenuado debajo: el nombre de catálogo, solo si hay alias.
  const tecnico = alias !== '' && nombreCatalogo !== alias ? nombreCatalogo : '';
  const cantidad = toQuantity(draft);

  return (
    <View
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        enCarrito > 0
          ? 'border-emerald-300'
          : enCambio > 0
            ? 'border-amber-300'
            : 'border-slate-200'
      }`}
    >
      {/* Los nombres del ERP van en mayúsculas y llegan a 40 caracteres: el nombre usa todo el ancho. */}
      <Text className="text-lg font-bold text-slate-900" numberOfLines={3}>
        {nombre}
      </Text>
      {tecnico !== '' && (
        <Text className="mt-0.5 text-sm font-medium text-slate-500" numberOfLines={2}>
          {tecnico}
        </Text>
      )}
      {(codigo !== '' || enCarrito > 0 || enCambio > 0) && (
        <View className="mt-1 flex-row flex-wrap items-center justify-between gap-2">
          <Text className="text-sm font-medium text-slate-400" numberOfLines={1}>
            {codigo !== '' ? `Cód. ${codigo}` : ''}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {enCarrito > 0 && <Badge tone="success" icon={Check} label={`En pedido: ${enCarrito}`} />}
            {enCambio > 0 && <Badge tone="warning" icon={RefreshCw} label={`Cambio: ${enCambio}`} />}
          </View>
        </View>
      )}

      <View className="mt-3 flex-row items-center gap-1.5">
        <StepButton
          icon={Minus}
          tone="neutral"
          accessibilityLabel={`Restar ${nombre}`}
          onPress={() => onStep(nombre, -1)}
        />
        <TextInput
          value={draft}
          onChangeText={(text) => onChangeDraft(nombre, text)}
          onFocus={() => onFocusRow(rowKey)}
          keyboardType="number-pad"
          selectTextOnFocus
          maxLength={4}
          selectionColor={colors.brand.DEFAULT}
          className="h-12 w-14 rounded-xl border-2 border-slate-200 bg-slate-50 p-0 text-center text-xl font-extrabold text-slate-900 focus:border-brand focus:bg-white"
          accessibilityLabel={`Cantidad de ${nombre}`}
        />
        <StepButton
          icon={Plus}
          tone="brand"
          accessibilityLabel={`Sumar ${nombre}`}
          onPress={() => onStep(nombre, 1)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Agregar ${nombre}`}
          accessibilityState={{ disabled: cantidad <= 0 }}
          disabled={cantidad <= 0}
          onPress={() => onAdd(nombre, cantidad)}
          className={`ml-1.5 h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand px-2 shadow-sm active:scale-[0.97] active:bg-brand-800 ${
            cantidad <= 0 ? 'opacity-40' : ''
          }`}
        >
          <PackagePlus size={20} color={colors.white} strokeWidth={2.5} />
          <Text className="text-lg font-bold text-white" numberOfLines={1}>
            Agregar
          </Text>
        </Pressable>
      </View>

      {onAddCambio && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Registrar cambio de ${nombre}`}
          accessibilityState={{ disabled: cantidad <= 0 }}
          disabled={cantidad <= 0}
          onPress={() => onAddCambio(nombre, cantidad)}
          className={`mt-2.5 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 active:scale-[0.98] active:bg-amber-100 ${
            cantidad <= 0 ? 'opacity-40' : ''
          }`}
        >
          <RefreshCw size={17} color={colors.amber[700]} strokeWidth={2.4} />
          <Text className="text-base font-bold text-amber-900" numberOfLines={1}>
            Registrar cambio ({cantidad})
          </Text>
        </Pressable>
      )}
    </View>
  );
});

interface StepButtonProps {
  icon: LucideIcon;
  tone: 'neutral' | 'brand';
  accessibilityLabel: string;
  onPress: () => void;
}

/** Botón cuadrado de − / +: se lee como botón (borde, relleno y sombra), no como texto. */
function StepButton({ icon: Icon, tone, accessibilityLabel, onPress }: StepButtonProps) {
  const brand = tone === 'brand';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={`h-12 w-12 items-center justify-center rounded-xl border-2 shadow-sm active:scale-95 ${
        brand
          ? 'border-brand-200 bg-brand-50 active:bg-brand-100'
          : 'border-slate-300 bg-white active:bg-slate-100'
      }`}
    >
      <Icon size={24} color={brand ? colors.brand.DEFAULT : colors.slate[700]} strokeWidth={3} />
    </Pressable>
  );
}
