import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleAlert, CircleCheck, X } from '@/lib/icons';
import colors from '@/theme/colors';

export type Feedback = { ok: boolean; text: string } | null;

interface ToastProps {
  feedback: Feedback;
  onClose: () => void;
}

/** Aviso flotante ARRIBA de la pantalla (no tapa los botones de abajo). Verde si salió bien, rojo si no. */
export function Toast({ feedback, onClose }: ToastProps) {
  const insets = useSafeAreaInsets();
  if (!feedback) return null;
  return (
    <View pointerEvents="box-none" className="absolute inset-x-4 z-50" style={{ top: insets.top + 8 }}>
      <View
        accessibilityLiveRegion="polite"
        className={`flex-row items-start gap-3 rounded-xl border p-4 shadow-xl ${
          feedback.ok ? 'border-emerald-200 bg-emerald-50' : 'border-accent-200 bg-accent-50'
        }`}
      >
        {feedback.ok ? (
          <CircleCheck size={24} color={colors.emerald[700]} strokeWidth={2.5} />
        ) : (
          <CircleAlert size={24} color={colors.accent.DEFAULT} strokeWidth={2.5} />
        )}
        <Text className={`flex-1 text-base font-semibold ${feedback.ok ? 'text-emerald-800' : 'text-accent-700'}`}>
          {feedback.text}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar mensaje"
          onPress={onClose}
          hitSlop={12}
          className="h-8 w-8 items-center justify-center rounded-full active:bg-black/10"
        >
          <X size={20} color={feedback.ok ? colors.emerald[800] : colors.accent[700]} strokeWidth={3} />
        </Pressable>
      </View>
    </View>
  );
}
