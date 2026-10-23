import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { Toast } from '@/components/Toast';
import { useFinalizarRuta } from '@/hooks/useFinalizarRuta';
import { useToast } from '@/hooks/useToast';
import { ChevronRight, Clock, Flag, Route, Store } from '@/lib/icons';
import { avanceRuta, formatInicio } from '@/lib/rutas';
import { useStore } from '@/store/useStore';
import colors from '@/theme/colors';

export default function RoutesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rutas = useStore((s) => s.rutas);
  const tiendas = useStore((s) => s.tiendas);
  const rutaActiva = useStore((s) => s.rutaActiva);
  const iniciarRuta = useStore((s) => s.iniciarRuta);
  const { feedback, mostrar, cerrar: cerrarAviso } = useToast();
  const { abrir: confirmarFinalizar, dialogo: dialogoFinalizar } = useFinalizarRuta((ruta) =>
    mostrar({
      ok: true,
      text: `${ruta.nombre} finalizada. ${
        ruta.pedidosBorrados > 0 ? `Se borraron ${ruta.pedidosBorrados} ${ruta.pedidosBorrados === 1 ? 'pedido' : 'pedidos'}.` : 'No había pedidos.'
      }`,
    }),
  );
  // Ruta que se quiere iniciar mientras otra sigue en curso: espera la respuesta del diálogo.
  const [cambiarA, setCambiarA] = useState<string | null>(null);

  const tiendasPorRuta = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tiendas) counts[t.ruta] = (counts[t.ruta] ?? 0) + 1;
    return counts;
  }, [tiendas]);

  const verTiendas = (ruta: string) => router.push({ pathname: '/stores/[ruta]', params: { ruta } });
  const iniciar = (ruta: string) => {
    // Primero se navega y después se cambia el estado: al revés, esta pantalla alcanza a redibujarse (aparece el
    // banner de "ruta en curso") un instante antes de que llegue la de tiendas.
    verTiendas(ruta);
    iniciarRuta(ruta);
  };

  // Elegir una ruta la inicia, siempre desde cero. Si ya hay otra en curso se pregunta,
  // con la opción de solo mirar sus tiendas sin cambiar el estado.
  const elegirRuta = (ruta: string) => {
    if (rutaActiva?.nombre === ruta) {
      verTiendas(ruta);
      return;
    }
    if (rutaActiva) {
      setCambiarA(ruta);
      return;
    }
    iniciar(ruta);
  };

  const avance = rutaActiva ? avanceRuta(rutaActiva, tiendas) : null;

  return (
    <>
    <FlatList
      className="flex-1 bg-slate-50"
      data={rutas}
      keyExtractor={(ruta) => ruta}
      contentContainerClassName="gap-3 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      ListHeaderComponent={
        rutas.length > 0 ? (
          <View className="mb-1 gap-4">
            {rutaActiva && avance && (
              <View className="gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-amber-600">
                    <Route size={26} color={colors.white} strokeWidth={2.2} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold tracking-wider text-amber-800">RUTA EN CURSO</Text>
                    <Text className="text-xl font-bold text-slate-900" numberOfLines={1}>
                      {rutaActiva.nombre}
                    </Text>
                    <View className="flex-row items-center gap-1.5">
                      <Clock size={14} color={colors.slate[600]} strokeWidth={2.4} />
                      <Text className="text-base text-slate-700">
                        Desde {formatInicio(rutaActiva.iniciadaEn)} · {avance.atendidas} de {avance.total} gestionadas
                      </Text>
                    </View>
                  </View>
                </View>
                <Button variant="warning" icon={Flag} label="Finalizar ruta" onPress={confirmarFinalizar} />
              </View>
            )}
            <Text className="text-lg font-semibold text-slate-600">
              {rutaActiva ? 'Rutas' : 'Elige una ruta para iniciarla'} · {rutas.length}{' '}
              {rutas.length === 1 ? 'disponible' : 'disponibles'}
            </Text>
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState
          icon={Route}
          title="No hay rutas"
          message="Vuelve al inicio y sincroniza el catálogo."
        />
      }
      renderItem={({ item: ruta }) => {
        const total = tiendasPorRuta[ruta] ?? 0;
        const enCurso = rutaActiva?.nombre === ruta;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityHint={enCurso ? 'Ruta en curso' : undefined}
            onPress={() => elegirRuta(ruta)}
            className={`min-h-24 flex-row items-center gap-4 rounded-xl bg-milk p-4 shadow-sm ${
              enCurso
                ? 'border-2 border-amber-400 active:bg-amber-50'
                : 'border border-slate-200 active:border-brand-200 active:bg-brand-50'
            }`}
          >
            <View
              className={`h-14 w-14 items-center justify-center rounded-xl ${enCurso ? 'bg-amber-600' : 'bg-brand'}`}
            >
              <Route size={28} color={colors.white} strokeWidth={2.2} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-2xl font-bold text-slate-900" numberOfLines={2}>
                {ruta}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <Store size={16} color={colors.slate[600]} strokeWidth={2.4} />
                <Text className="text-base font-medium text-slate-600">
                  {total} {total === 1 ? 'tienda' : 'tiendas'}
                </Text>
              </View>
              {enCurso && <Badge tone="warning" label="En curso" />}
            </View>
            <ChevronRight size={28} color={colors.slate[400]} strokeWidth={2.5} />
          </Pressable>
        );
      }}
    />
    <Toast feedback={feedback} onClose={cerrarAviso} />
    {dialogoFinalizar}
    <Dialog
      visible={cambiarA !== null}
      tone="warning"
      icon={Route}
      title={`${rutaActiva?.nombre ?? 'La ruta'} está en curso`}
      message={`¿Quieres cambiar a ${cambiarA}? Sus pedidos no se borran: siguen en «Enviar pedidos». También puedes solo ver sus tiendas sin cambiar de ruta.`}
      actions={[
        { label: 'Cancelar', variant: 'secondary', onPress: () => setCambiarA(null) },
        {
          label: 'Solo ver las tiendas',
          variant: 'secondary',
          onPress: () => {
            if (cambiarA) verTiendas(cambiarA);
            setCambiarA(null);
          },
        },
        {
          label: 'Cambiar de ruta',
          variant: 'primary',
          icon: Route,
          onPress: () => {
            if (cambiarA) iniciar(cambiarA);
            setCambiarA(null);
          },
        },
      ]}
      onClose={() => setCambiarA(null)}
    />
    </>
  );
}
