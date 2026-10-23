import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import colors from '@/theme/colors';

type Tone = 'success' | 'brand' | 'danger' | 'warning' | 'neutral';

const TONES: Record<Tone, { box: string; text: string; tint: string }> = {
  success: { box: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-800', tint: colors.emerald[700] },
  brand: { box: 'border-brand-200 bg-brand-50', text: 'text-brand-700', tint: colors.brand.DEFAULT },
  danger: { box: 'border-accent-200 bg-accent-50', text: 'text-accent-700', tint: colors.accent[700] },
  // Ámbar: ruta en curso.
  warning: { box: 'border-amber-300 bg-amber-50', text: 'text-amber-800', tint: colors.amber[700] },
  neutral: { box: 'border-slate-200 bg-slate-100', text: 'text-slate-700', tint: colors.slate[600] },
};

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: LucideIcon;
}

/** Píldora de estado (ej. "3 productos" en una tienda que ya tiene pedido). */
export function Badge({ label, tone = 'neutral', icon: Icon }: BadgeProps) {
  const style = TONES[tone];
  return (
    <View className={`shrink-0 flex-row items-center gap-1.5 self-start rounded-full border px-3 py-1.5 ${style.box}`}>
      {Icon && <Icon size={14} color={style.tint} strokeWidth={3} />}
      <Text className={`text-sm font-bold ${style.text}`}>{label}</Text>
    </View>
  );
}
