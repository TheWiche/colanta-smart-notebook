import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { useStore } from '@/store/useStore';
import colors from '@/theme/colors';

export default function RootLayout() {
  // Hasta hidratar AsyncStorage el estado está vacío; mostrarlo sería engañoso.
  const hasHydrated = useStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand.DEFAULT },
          headerTintColor: colors.white,
          headerTitleStyle: { color: colors.white, fontSize: 20, fontWeight: '700' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.slate[50] },
        }}
      >
        {/* Home dibuja su propio encabezado "Colanta Smart". */}
        <Stack.Screen name="index" options={{ title: 'Libreta de Pedidos', headerShown: false }} />
        <Stack.Screen name="routes" options={{ title: 'Rutas' }} />
        <Stack.Screen name="stores/[ruta]" options={{ title: 'Tiendas' }} />
        <Stack.Screen name="new-store" options={{ title: 'Tienda no registrada' }} />
        <Stack.Screen name="order/[codigo]" options={{ title: 'Pedido' }} />
        <Stack.Screen name="send" options={{ title: 'Enviar pedidos' }} />
      </Stack>
    </>
  );
}
