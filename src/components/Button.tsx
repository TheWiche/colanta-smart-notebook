import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import colors from '@/theme/colors';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'saved' | 'warning' | 'danger';

// Las clases van completas (nunca armadas por partes) para que Tailwind las detecte al compilar.
const VARIANTS: Record<ButtonVariant, { box: string; text: string; tint: string }> = {
  primary: {
    box: 'border-brand bg-brand shadow-md active:bg-brand-800',
    text: 'text-white',
    tint: colors.white,
  },
  secondary: {
    box: 'border-brand bg-white shadow-sm active:bg-brand-50',
    text: 'text-brand',
    tint: colors.brand.DEFAULT,
  },
  success: {
    box: 'border-emerald-700 bg-emerald-700 shadow-md active:bg-emerald-800',
    text: 'text-white',
    tint: colors.white,
  },
  // Estado "ya guardado": se ve como confirmación, no como un botón apagado.
  saved: {
    box: 'border-emerald-200 bg-emerald-50',
    text: 'text-emerald-800',
    tint: colors.emerald[700],
  },
  // Ámbar con borde: acciones sobre la ruta en curso (ej. finalizarla).
  warning: {
    box: 'border-amber-700 bg-white shadow-sm active:bg-amber-50',
    text: 'text-amber-800',
    tint: colors.amber[800],
  },
  // Acciones que borran: rojo de acento.
  danger: {
    box: 'border-accent-700 bg-accent-700 shadow-md active:bg-accent-600',
    text: 'text-white',
    tint: colors.white,
  },
};

const SIZES = {
  md: { box: 'min-h-14 px-5', icon: 22 },
  lg: { box: 'min-h-16 px-5', icon: 26 },
} as const;

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  loading?: boolean;
  disabled?: boolean;
}

/** Botón ancho y alto (≥ 56 px) con ícono y feedback al tocar (cambio de color + leve reducción). */
export function Button({
  label,
  onPress,
  icon: Icon,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const style = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-3 rounded-xl border-2 active:scale-[0.98] ${SIZES[size].box} ${style.box} ${
        disabled && variant !== 'saved' ? 'opacity-40' : ''
      }`}
    >
      {loading ? (
        <ActivityIndicator color={style.tint} />
      ) : Icon ? (
        <Icon size={SIZES[size].icon} color={style.tint} strokeWidth={2.5} />
      ) : null}
      <Text className={`shrink text-center text-lg font-bold ${style.text}`}>{label}</Text>
    </Pressable>
  );
}
