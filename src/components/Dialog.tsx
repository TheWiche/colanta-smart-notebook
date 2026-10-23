import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button, type ButtonVariant } from '@/components/Button';
import colors from '@/theme/colors';

type Tone = 'brand' | 'warning' | 'danger' | 'success';

const TONES: Record<Tone, { circle: string; tint: string }> = {
  brand: { circle: 'bg-brand-50', tint: colors.brand.DEFAULT },
  warning: { circle: 'bg-amber-100', tint: colors.amber[700] },
  danger: { circle: 'bg-accent-50', tint: colors.accent.DEFAULT },
  success: { circle: 'bg-emerald-50', tint: colors.emerald[700] },
};

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
}

interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Contenido extra bajo el mensaje (por ejemplo, un resumen). */
  children?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  /** De arriba hacia abajo; la última suele ser la acción principal. Cada una decide si cierra el diálogo. */
  actions: DialogAction[];
  /** Tocar fuera o el botón atrás de Android. */
  onClose: () => void;
}

/**
 * Diálogo de confirmación con el diseño de la app (reemplaza a `Alert.alert`, que se ve como del sistema).
 * Botones a todo el ancho y altos, para tocarlos con una mano.
 */
export function Dialog({ visible, title, message, children, icon: Icon, tone = 'brand', actions, onClose }: DialogProps) {
  const style = TONES[tone];
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Cerrar"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-slate-900/60 px-5"
      >
        {/* Tocar la tarjeta no debe cerrar el diálogo. */}
        <Pressable
          accessible={false}
          onPress={() => {}}
          className="w-full max-w-md gap-4 rounded-3xl border border-slate-200 bg-milk p-6 shadow-2xl"
        >
          <View className="flex-row items-center gap-4">
            {Icon && (
              <View className={`h-14 w-14 items-center justify-center rounded-2xl ${style.circle}`}>
                <Icon size={30} color={style.tint} strokeWidth={2.4} />
              </View>
            )}
            <Text accessibilityRole="header" className="flex-1 text-2xl font-extrabold text-slate-900">
              {title}
            </Text>
          </View>
          {message ? <Text className="text-lg text-slate-700">{message}</Text> : null}
          {children}
          <View className="gap-3 pt-1">
            {actions.map((action) => (
              <Button
                key={action.label}
                label={action.label}
                icon={action.icon}
                variant={action.variant ?? 'secondary'}
                onPress={action.onPress}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
