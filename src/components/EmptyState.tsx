import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import colors from '@/theme/colors';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  /** Acción opcional debajo del mensaje (por ejemplo, un botón). */
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, message, children }: EmptyStateProps) {
  return (
    <View className="items-center px-6 py-16">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-50">
        <Icon size={36} color={colors.brand.DEFAULT} strokeWidth={2} />
      </View>
      <Text className="mt-5 text-center text-xl font-bold text-slate-900">{title}</Text>
      <Text className="mt-2 text-center text-lg text-slate-600">{message}</Text>
      {children && <View className="mt-6 w-full">{children}</View>}
    </View>
  );
}
