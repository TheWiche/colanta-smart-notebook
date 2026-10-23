import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Minus, Plus, Trash } from '@/lib/icons';
import { toQuantity } from '@/lib/quantity';
import colors from '@/theme/colors';

interface QuantityModalProps {
  /** Producto cuya cantidad se edita; `null` = cerrado. */
  producto: string | null;
  cantidad: number;
  /** Cantidad nueva (>= 1). */
  onConfirm: (cantidad: number) => void;
  /** Quitar el producto del pedido. */
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Edita la cantidad de un producto del pedido con el teclado numérico. La tarjeta va arriba para que el teclado no la
 * tape. Con 0 no hay cantidad: se ofrece quitar el producto.
 * Quien lo use debe darle una `key` distinta por producto, para que el texto arranque con su cantidad.
 */
export function QuantityModal({ producto, cantidad, onConfirm, onRemove, onClose }: QuantityModalProps) {
  const [texto, setTexto] = useState(String(cantidad));

  const valor = toQuantity(texto);
  const paso = (delta: number) => setTexto(String(Math.max(0, valor + delta)));

  return (
    <Modal visible={producto !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Cerrar" onPress={onClose} className="flex-1 items-center bg-slate-900/60 px-5 pt-24">
        <Pressable
          accessible={false}
          onPress={() => {}}
          className="w-full max-w-md gap-4 rounded-3xl border border-slate-200 bg-milk p-6 shadow-2xl"
        >
          <Text className="text-xl font-extrabold text-slate-900" numberOfLines={3}>
            {producto}
          </Text>
          <View className="flex-row items-center justify-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restar uno"
              onPress={() => paso(-1)}
              className="h-14 w-14 items-center justify-center rounded-xl border-2 border-slate-300 bg-white active:bg-slate-100"
            >
              <Minus size={26} color={colors.slate[700]} strokeWidth={3} />
            </Pressable>
            <TextInput
              value={texto}
              onChangeText={(t) => setTexto(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              maxLength={4}
              selectionColor={colors.brand.DEFAULT}
              accessibilityLabel={`Cantidad de ${producto ?? ''}`}
              className="h-16 w-28 rounded-xl border-2 border-brand bg-white p-0 text-center text-3xl font-extrabold text-slate-900"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sumar uno"
              onPress={() => paso(1)}
              className="h-14 w-14 items-center justify-center rounded-xl border-2 border-brand-200 bg-brand-50 active:bg-brand-100"
            >
              <Plus size={26} color={colors.brand.DEFAULT} strokeWidth={3} />
            </Pressable>
          </View>
          {valor > 0 ? (
            <Button label="Guardar cantidad" onPress={() => onConfirm(valor)} />
          ) : (
            <Button label="Quitar del pedido" icon={Trash} variant="danger" onPress={onRemove} />
          )}
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
