import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Toast } from '@/components/Toast';
import { URL_PRODUCTOS, URL_TIENDAS } from '@/config';
import { useFinalizarRuta } from '@/hooks/useFinalizarRuta';
import { useToast } from '@/hooks/useToast';
import {
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  Database,
  Flag,
  MessageCircle,
  Milk,
  Package,
  RefreshCw,
  Route,
  Send,
  Store,
} from '@/lib/icons';
import { avanceRuta, formatInicio } from '@/lib/rutas';
import { copyOrdersToClipboard } from '@/services/whatsapp';
import { useStore } from '@/store/useStore';
import colors from '@/theme/colors';
import type { RutaActiva, RutaConcluida } from '@/types';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatSync(ts: number | null) {
  if (!ts) return 'Nunca sincronizado';
  return `Última sincronización: ${new Date(ts).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pedidos = useStore((s) => s.pedidos);
  const isSyncing = useStore((s) => s.isSyncing);
  const lastSyncAt = useStore((s) => s.lastSyncAt);
  const tiendas = useStore((s) => s.tiendas);
  const rutas = useStore((s) => s.rutas.length);
  const productos = useStore((s) => s.productos.length);
  const rutaActiva = useStore((s) => s.rutaActiva);
  const syncData = useStore((s) => s.syncData);
  const { feedback, mostrar: setFeedback, cerrar: cerrarAviso } = useToast();

  const conPedido = Object.values(pedidos).filter((p) => p.items.length > 0);
  const pendientes = conPedido.filter((p) => !p.enviadoEn).length;
  const enviados = conPedido.length - pendientes;

  const avisarFinalizada = (ruta: RutaConcluida) => {
    const atendidas = ruta.atendidas.length;
    setFeedback({
      ok: true,
      text: `${ruta.nombre} finalizada${atendidas > 0 ? `: ${plural(atendidas, 'tienda atendida', 'tiendas atendidas')}` : ''}. ${
        ruta.pedidosBorrados > 0 ? `Se borraron ${plural(ruta.pedidosBorrados, 'pedido', 'pedidos')}.` : 'No había pedidos.'
      }`,
    });
  };
  const { abrir: confirmarFinalizar, dialogo: dialogoFinalizar } = useFinalizarRuta(avisarFinalizada);

  const onCopy = async () => {
    setFeedback(null);
    try {
      const sinEnviarMapa = Object.fromEntries(Object.entries(pedidos).filter(([, p]) => !p.enviadoEn));
      if ((await copyOrdersToClipboard(sinEnviarMapa)) === 'empty') return;
      setFeedback({
        ok: true,
        text: `${plural(pendientes, 'pedido copiado', 'pedidos copiados')}. Pégalos en el chat que quieras.`,
      });
    } catch {
      setFeedback({ ok: false, text: 'No se pudo copiar al portapapeles.' });
    }
  };

  // `updatedAt` es el último cambio del pedido: cuenta los tocados hoy.
  const pedidosHoy = useMemo(() => {
    const since = startOfToday();
    return Object.values(pedidos).filter((p) => p.updatedAt >= since).length;
  }, [pedidos]);

  const hasCatalog = rutas > 0 && productos > 0;

  const onSync = async () => {
    setFeedback(null);
    if (!URL_TIENDAS || !URL_PRODUCTOS) {
      setFeedback({ ok: false, text: 'Faltan las URLs de las hojas. Revisa el archivo .env.' });
      return;
    }
    try {
      const r = await syncData(URL_TIENDAS, URL_PRODUCTOS);
      const omitidas = r.hojasOmitidas.length;
      setFeedback({
        ok: true,
        text:
          `Catálogo actualizado: ${r.rutas} ${r.rutas === 1 ? 'ruta' : 'rutas'}, ${r.tiendas} tiendas, ` +
          `${r.productos} productos.` +
          (omitidas > 0
            ? ` ${omitidas === 1 ? 'La hoja' : 'Las hojas'} ${r.hojasOmitidas.map((h) => `«${h}»`).join(', ')} no ${
                omitidas === 1 ? 'tiene' : 'tienen'
              } tiendas.`
            : '') +
          (r.sinCodigo > 0
            ? ` ${r.sinCodigo} ${r.sinCodigo === 1 ? 'tienda está' : 'tiendas están'} sin código en la hoja (salen como «SIN CÓDIGO»).`
            : '') +
          (r.sinRuta > 0
            ? ` Ojo: ${r.sinRuta} ${r.sinRuta === 1 ? 'tienda llegó' : 'tiendas llegaron'} sin ruta en la hoja (quedan en «Sin ruta»).`
            : ''),
      });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Error desconocido.' });
    }
  };

  const catalogCard = (
    <View className="rounded-2xl border border-slate-200 bg-milk p-5 shadow-sm">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
          <Database size={24} color={colors.brand.DEFAULT} strokeWidth={2.2} />
        </View>
        <View className="flex-1">
          <Text className="text-xl font-bold text-slate-900">Catálogo</Text>
          <Text className="text-base text-slate-600">{formatSync(lastSyncAt)}</Text>
        </View>
      </View>

      {hasCatalog && (
        <View className="mt-4 flex-row gap-2">
          <MiniStat icon={Route} value={rutas} label="Rutas" />
          <MiniStat icon={Store} value={tiendas.length} label="Tiendas" />
          <MiniStat icon={Package} value={productos} label="Productos" />
        </View>
      )}

      <View className="mt-4">
        <Button
          label={isSyncing ? 'Sincronizando…' : 'Sincronizar Catálogo'}
          icon={RefreshCw}
          loading={isSyncing}
          onPress={onSync}
        />
      </View>

      {!hasCatalog && (
        <Text className="mt-4 text-center text-base text-slate-600">
          Sincroniza el catálogo para poder iniciar.
        </Text>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={[colors.brand[900], colors.brand[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 12,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View className="flex-row items-center gap-4 px-5 pb-6">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
            <Milk size={30} color={colors.white} strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text className="text-3xl font-extrabold text-white">Colanta Smart</Text>
            <Text className="text-base font-medium text-brand-200">Libreta de pedidos</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-3">
          <StatCard
            icon={ClipboardCheck}
            value={pedidosHoy}
            label={pedidosHoy === 1 ? 'Pedido hoy' : 'Pedidos hoy'}
          />
          <StatCard icon={Send} value={pendientes} label="Por enviar" alert={pendientes > 0} />
        </View>

        {/* Sin catálogo, sincronizar es el único paso posible: va primero. */}
        {!hasCatalog && catalogCard}

        {rutaActiva ? (
          // Ruta en curso: el botón cambia de color y lleva directo a sus tiendas.
          <View className="gap-3">
            <ActiveRouteCard
              ruta={rutaActiva}
              avance={avanceRuta(rutaActiva, tiendas)}
              onPress={() => router.push({ pathname: '/stores/[ruta]', params: { ruta: rutaActiva.nombre } })}
            />
            <Button variant="warning" icon={Flag} label="Finalizar ruta" onPress={confirmarFinalizar} />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/routes')}
              className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl active:bg-brand-50"
            >
              <Route size={20} color={colors.brand.DEFAULT} strokeWidth={2.4} />
              <Text className="text-base font-bold text-brand">Ver todas las rutas</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasCatalog }}
            disabled={!hasCatalog}
            onPress={() => router.push('/routes')}
            className={`rounded-2xl bg-brand shadow-lg active:scale-[0.98] ${hasCatalog ? '' : 'opacity-40'}`}
          >
            <LinearGradient
              colors={[colors.brand[700], colors.brand[500]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 16, padding: 20 }}
            >
              <View className="flex-row items-center gap-4">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-white/20">
                  <Route size={28} color={colors.white} strokeWidth={2.4} />
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-extrabold text-white">Iniciar Ruta</Text>
                  <Text className="text-base font-medium text-brand-100">
                    Elige una ruta y toma pedidos
                  </Text>
                </View>
                <ChevronRight size={30} color={colors.white} strokeWidth={2.5} />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        <View className="gap-2">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                variant="success"
                size="lg"
                icon={MessageCircle}
                label="Enviar pedidos"
                disabled={conPedido.length === 0}
                onPress={() => router.push('/send')}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copiar todos los pedidos"
              accessibilityState={{ disabled: pendientes === 0 }}
              disabled={pendientes === 0}
              onPress={onCopy}
              className={`h-16 w-16 items-center justify-center rounded-xl border-2 border-emerald-700 bg-white shadow-sm active:scale-[0.98] active:bg-emerald-50 ${
                pendientes === 0 ? 'opacity-40' : ''
              }`}
            >
              <Copy size={26} color={colors.emerald[700]} strokeWidth={2.5} />
            </Pressable>
          </View>
          <Text className="text-center text-base text-slate-600">
            {conPedido.length === 0
              ? 'No hay pedidos.'
              : `${pendientes} sin enviar · ${enviados} ${enviados === 1 ? 'enviado' : 'enviados'}`}
          </Text>
        </View>

        {hasCatalog && catalogCard}
      </ScrollView>

      <Toast feedback={feedback} onClose={cerrarAviso} />
      {dialogoFinalizar}
    </View>
  );
}

interface ActiveRouteCardProps {
  ruta: RutaActiva;
  avance: { atendidas: number; total: number };
  onPress: () => void;
}

/** Botón principal mientras hay una ruta en curso: ámbar, con el avance y la hora de inicio. */
function ActiveRouteCard({ ruta, avance, onPress }: ActiveRouteCardProps) {
  const progreso = avance.total > 0 ? Math.min(100, Math.round((avance.atendidas / avance.total) * 100)) : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continuar ${ruta.nombre}, ruta en curso`}
      onPress={onPress}
      className="rounded-2xl bg-amber-700 shadow-lg active:scale-[0.98]"
    >
      {/* Claro arriba (título grande) y oscuro abajo, donde va el texto pequeño: buen contraste al sol. */}
      <LinearGradient
        colors={[colors.amber[600], colors.amber[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16, padding: 20 }}
      >
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <Route size={28} color={colors.white} strokeWidth={2.4} />
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-1.5 self-start rounded-full bg-white px-2.5 py-1">
              <View className="h-2 w-2 rounded-full bg-amber-600" />
              <Text className="text-xs font-extrabold tracking-wider text-amber-800">EN CURSO</Text>
            </View>
            <Text className="text-2xl font-extrabold text-white">Continuar ruta</Text>
            <Text className="text-lg font-bold text-amber-50" numberOfLines={1}>
              {ruta.nombre}
            </Text>
          </View>
          <ChevronRight size={30} color={colors.white} strokeWidth={2.5} />
        </View>

        <View className="mt-4 gap-2">
          <View className="h-2.5 overflow-hidden rounded-full bg-white/25">
            <View className="h-full rounded-full bg-white" style={{ width: `${progreso}%` }} />
          </View>
          <View className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <View className="flex-row items-center gap-1.5">
              <Store size={16} color={colors.white} strokeWidth={2.4} />
              <Text className="text-base font-bold text-white">
                {avance.total > 0
                  ? `${avance.atendidas} de ${plural(avance.total, 'tienda', 'tiendas')} gestionadas`
                  : 'Sin tiendas atendidas aún'}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Clock size={16} color={colors.white} strokeWidth={2.4} />
              <Text className="text-base font-bold text-white">Desde {formatInicio(ruta.iniciadaEn)}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  value: number;
  label: string;
  /** Rojo de acento: hay algo pendiente que atender. */
  alert?: boolean;
}

function StatCard({ icon: Icon, value, label, alert = false }: StatCardProps) {
  return (
    <View className="flex-1 rounded-2xl border border-slate-200 bg-milk p-4 shadow-sm">
      <View
        className={`h-12 w-12 items-center justify-center rounded-xl ${alert ? 'bg-accent-50' : 'bg-brand-50'}`}
      >
        <Icon size={26} color={alert ? colors.accent.DEFAULT : colors.brand.DEFAULT} strokeWidth={2.2} />
      </View>
      <Text className={`mt-3 text-5xl font-extrabold ${alert ? 'text-accent' : 'text-slate-900'}`}>{value}</Text>
      <Text className="text-lg font-semibold text-slate-600">{label}</Text>
    </View>
  );
}

function MiniStat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <View className="flex-1 items-center rounded-xl bg-slate-100 py-3">
      <Icon size={20} color={colors.slate[600]} strokeWidth={2.2} />
      <Text className="mt-1 text-xl font-extrabold text-slate-900">{value}</Text>
      <Text className="text-sm font-semibold text-slate-600">{label}</Text>
    </View>
  );
}
