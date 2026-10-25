import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Check, Minus, Plus, RefreshCw, Trash } from '@/lib/icons';
import { toQuantity } from '@/lib/quantity';
import colors from '@/theme/colors';

interface QuantityModalProps {
  /** Producto cuya cantidad se edita; `null` = cerrado. */
  producto: string | null;
  cantidad: number;
  esCambio?: boolean;
  /** Cantidad nueva (>= 1) y si es cambio por vencimiento o pedido normal. */
  onConfirm: (cantidad: number, esCambio?: boolean) => void;
  /** Quitar el producto del pedido. */
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Edita la cantidad de un producto del pedido con el teclado numérico. Permite además
 * alternar entre pedido normal y cambio por vencimiento. La tarjeta va arriba para que el teclado no la
 * tape. Con 0 no hay cantidad: se ofrece quitar el producto.
 * Quien lo use debe darle una `key` distinta por producto/tipo, para que el texto arranque con su cantidad.
 */
export function QuantityModal({
  producto,
  cantidad,
  esCambio = false,
  onConfirm,
  onRemove,
  onClose,
}: QuantityModalProps) {
  const [texto, setTexto] = useState(String(cantidad));
  const [cambio, setCambio] = useState(Boolean(esCambio));

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

          {/* Selector de Tipo: Pedido Normal vs Cambio por Vencimiento */}
          <View className="flex-row rounded-xl border border-slate-200 bg-slate-100 p-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Marcar como pedido normal"
              onPress={() => setCambio(false)}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${
                !cambio ? 'border border-slate-200 bg-white shadow-sm' : ''
              }`}
            >
              <Check size={16} color={!cambio ? colors.emerald[700] : colors.slate[400]} strokeWidth={3} />
              <Text className={`text-sm font-bold ${!cambio ? 'text-slate-900' : 'text-slate-500'}`}>
                Pedido normal
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Marcar como cambio por vencimiento"
              onPress={() => setCambio(true)}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${
                cambio ? 'border border-amber-300 bg-amber-50 shadow-sm' : ''
              }`}
            >
              <RefreshCw size={16} color={cambio ? colors.amber[700] : colors.slate[400]} strokeWidth={2.5} />
              <Text className={`text-sm font-bold ${cambio ? 'text-amber-900' : 'text-slate-500'}`}>
                Cambio (Vencido)
              </Text>
            </Pressable>
          </View>

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
              selectionColor={cambio ? colors.amber[700] : colors.brand.DEFAULT}
              accessibilityLabel={`Cantidad de ${producto ?? ''}`}
              className={`h-16 w-28 rounded-xl border-2 bg-white p-0 text-center text-3xl font-extrabold text-slate-900 ${
                cambio ? 'border-amber-400' : 'border-brand'
              }`}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sumar uno"
              onPress={() => paso(1)}
              className={`h-14 w-14 items-center justify-center rounded-xl border-2 active:bg-opacity-80 ${
                cambio ? 'border-amber-300 bg-amber-50' : 'border-brand-200 bg-brand-50'
              }`}
            >
              <Plus size={26} color={cambio ? colors.amber[700] : colors.brand.DEFAULT} strokeWidth={3} />
            </Pressable>
          </View>

          {valor > 0 ? (
            <Button
              label={cambio ? 'Guardar como cambio' : 'Guardar cantidad'}
              variant={cambio ? 'warning' : 'primary'}
              onPress={() => onConfirm(valor, cambio)}
            />
          ) : (
            <Button label="Quitar del pedido" icon={Trash} variant="danger" onPress={onRemove} />
          )}
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
