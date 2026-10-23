import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import {
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  MessageCircle,
  Share2,
} from '@/lib/icons';
import { displayCodigo } from '@/lib/manualStore';
import { formatHora } from '@/lib/rutas';
import {
  copySupervisionUrl,
  openSupervisionInBrowser,
  shareSupervisionLink,
} from '@/services/supervision';
import { copyOrdersToClipboard, sendOrdersByWhatsApp } from '@/services/whatsapp';
import { useStore } from '@/store/useStore';
import colors from '@/theme/colors';
import type { Order, OrdersByStore } from '@/types';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const unidades = (pedido: Order) => pedido.items.reduce((total, item) => total + item.cantidad, 0);
const comoMapa = (lista: readonly Order[]): OrdersByStore =>
  Object.fromEntries(lista.map((pedido) => [pedido.tienda.codigo, pedido]));

/**
 * Administra el envío y auditoría de pedidos.
 * Permite enviar un enlace web interactivo para supervisión (con checklist en vivo),
 * copiar el enlace, abrirlo en el navegador o usar el texto tradicional de WhatsApp.
 */
export default function SendScreen() {
  const insets = useSafeAreaInsets();
  const pedidos = useStore((s) => s.pedidos);
  const marcarEnviados = useStore((s) => s.marcarEnviados);
  const marcarPendiente = useStore((s) => s.marcarPendiente);
  const { feedback, mostrar, cerrar } = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [manual, setManual] = useState<Record<string, boolean>>({});

  const lista = useMemo(
    () =>
      Object.values(pedidos)
        .filter((pedido) => pedido.items.length > 0)
        .sort((a, b) => Number(!!a.enviadoEn) - Number(!!b.enviadoEn) || a.updatedAt - b.updatedAt),
    [pedidos],
  );
  const pendientes = lista.filter((pedido) => !pedido.enviadoEn);
  const enviados = lista.length - pendientes.length;
  const estaElegido = (pedido: Order) => manual[pedido.tienda.codigo] ?? !pedido.enviadoEn;
  const elegidos = lista.filter(estaElegido);
  const todosElegidos = lista.length > 0 && elegidos.length === lista.length;

  const alternar = (pedido: Order) => setManual((m) => ({ ...m, [pedido.tienda.codigo]: !estaElegido(pedido) }));
  const elegirTodos = () => setManual(Object.fromEntries(lista.map((pedido) => [pedido.tienda.codigo, !todosElegidos])));

  /**
   * Envía el enlace web interactivo de supervisión (por WhatsApp o Share).
   */
  const enviarEnlaceWeb = async (aEnviar: readonly Order[]) => {
    if (ocupado || aEnviar.length === 0) return;
    cerrar();
    setOcupado(true);
    try {
      const { result } = await shareSupervisionLink(comoMapa(aEnviar));
      if (result === 'empty') return;
      marcarEnviados(aEnviar.map((pedido) => pedido.tienda.codigo));
      setManual({});
      mostrar({
        ok: true,
        text: `Enlace web compartido con la supervisora. ${plural(
          aEnviar.length,
          'pedido marcado como enviado',
          'pedidos marcados como enviados',
        )}.`,
      });
    } catch (e) {
      mostrar({ ok: false, text: e instanceof Error ? e.message : 'No se pudo compartir el enlace.' });
    } finally {
      setOcupado(false);
    }
  };

  /**
   * Copia directamente el enlace del panel web al portapapeles.
   */
  const copiarEnlaceWeb = async () => {
    cerrar();
    try {
      const { result } = await copySupervisionUrl(comoMapa(elegidos));
      if (result === 'empty') return;
      mostrar({
        ok: true,
        text: 'Enlace del panel web copiado. Pégalo en el chat o correo de la supervisora.',
      });
    } catch {
      mostrar({ ok: false, text: 'No se pudo copiar el enlace web.' });
    }
  };

  /**
   * Abre el panel de supervisión directamente en el navegador del dispositivo para verificarlo.
   */
  const abrirNavegador = async () => {
    cerrar();
    try {
      const ok = await openSupervisionInBrowser(comoMapa(elegidos));
      if (!ok) mostrar({ ok: false, text: 'No hay pedidos seleccionados para abrir el panel.' });
    } catch {
      mostrar({ ok: false, text: 'No se pudo abrir el navegador.' });
    }
  };

  /**
   * Envío tradicional por texto plano de WhatsApp (fallback).
   */
  const enviarTextoWhatsApp = async (aEnviar: readonly Order[]) => {
    if (ocupado || aEnviar.length === 0) return;
    cerrar();
    setOcupado(true);
    try {
      const resultado = await sendOrdersByWhatsApp(comoMapa(aEnviar));
      if (resultado === 'empty') return;
      marcarEnviados(aEnviar.map((pedido) => pedido.tienda.codigo));
      setManual({});
      mostrar({
        ok: true,
        text: `Texto de pedidos enviado por WhatsApp.`,
      });
    } catch (e) {
      mostrar({ ok: false, text: e instanceof Error ? e.message : 'No se pudo abrir WhatsApp.' });
    } finally {
      setOcupado(false);
    }
  };

  /**
   * Copia texto plano tradicional.
   */
  const copiarTextoPlano = async () => {
    cerrar();
    try {
      if ((await copyOrdersToClipboard(comoMapa(elegidos))) === 'empty') return;
      mostrar({
        ok: true,
        text: `${plural(elegidos.length, 'pedido copiado', 'pedidos copiados')} en texto plano.`,
      });
    } catch {
      mostrar({ ok: false, text: 'No se pudo copiar el texto.' });
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ title: 'Enviar pedidos' }} />
      <FlatList
        data={lista}
        keyExtractor={(pedido) => pedido.tienda.codigo}
        contentContainerClassName="gap-3 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 230 + insets.bottom }}
        ListHeaderComponent={
          lista.length > 0 ? (
            <View className="mb-1 gap-3">
              <View className="flex-row gap-3">
                <Resumen valor={pendientes.length} etiqueta="Sin enviar" alerta={pendientes.length > 0} />
                <Resumen valor={enviados} etiqueta={enviados === 1 ? 'Enviado' : 'Enviados'} />
              </View>

              {/* Banner informativo del panel web */}
              <View className="flex-row items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3.5">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand">
                  <Globe size={22} color={colors.white} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-brand-900">Panel Web de Supervisión</Text>
                  <Text className="text-sm font-medium text-brand-700">
                    La supervisora audita y transcribe con checklist interactivo en vivo.
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={elegirTodos}
                className="min-h-12 flex-row items-center gap-3 self-start rounded-xl px-1 active:bg-brand-50"
              >
                <Casilla marcada={todosElegidos} />
                <Text className="text-lg font-bold text-brand">
                  {todosElegidos ? 'Quitar selección' : 'Seleccionar todos'}
                </Text>
              </Pressable>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon={ClipboardCheck}
            title="No hay pedidos"
            message="Los pedidos que tomes en las tiendas aparecerán aquí para compartirlos con la supervisora."
          />
        }
        renderItem={({ item: pedido }) => {
          const elegido = estaElegido(pedido);
          const enviado = !!pedido.enviadoEn;
          return (
            <View
              className={`overflow-hidden rounded-2xl border-2 shadow-sm ${
                enviado
                  ? 'border-emerald-400 bg-emerald-50'
                  : elegido
                    ? 'border-brand-300 bg-milk'
                    : 'border-slate-200 bg-milk'
              }`}
            >
              {enviado && (
                <View className="flex-row items-center gap-3 bg-emerald-700 px-4 py-2.5">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
                    <Check size={18} color={colors.emerald[700]} strokeWidth={4} />
                  </View>
                  <Text className="flex-1 text-lg font-extrabold text-white">ENVIADO A SUPERVISIÓN</Text>
                  <Text className="text-lg font-bold text-emerald-50">{formatHora(pedido.enviadoEn!)}</Text>
                </View>
              )}
              <View className="gap-3 p-4">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: elegido }}
                  onPress={() => alternar(pedido)}
                  className="flex-row items-center gap-4"
                >
                  <Casilla marcada={elegido} />
                  <View className="flex-1 gap-1">
                    <Text className="text-xl font-bold text-slate-900" numberOfLines={2}>
                      {pedido.tienda.nombre}
                    </Text>
                    <Text className="text-base font-medium text-slate-600" numberOfLines={1}>
                      {[displayCodigo(pedido.tienda), pedido.tienda.ruta].filter(Boolean).join(' · ')}
                    </Text>
                    <Text className="text-base font-semibold text-slate-700">
                      {plural(pedido.items.length, 'producto', 'productos')} ·{' '}
                      {plural(unidades(pedido), 'unidad', 'unidades')}
                    </Text>
                  </View>
                </Pressable>

                {enviado ? (
                  <View className="flex-row gap-2">
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => marcarPendiente(pedido.tienda.codigo)}
                      className="min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-2 active:bg-slate-100"
                    >
                      <Text className="text-center text-sm font-bold text-slate-700">Marcar sin enviar</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={ocupado}
                      onPress={() => enviarEnlaceWeb([pedido])}
                      className={`min-h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-700 bg-white px-2 active:bg-emerald-100 ${
                        ocupado ? 'opacity-40' : ''
                      }`}
                    >
                      <Share2 size={18} color={colors.emerald[700]} strokeWidth={2.5} />
                      <Text className="text-sm font-bold text-emerald-800">Reenviar Web</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="flex-row items-center justify-between gap-3">
                    <Badge tone="warning" icon={Clock} label="Sin enviar" />
                    <Pressable
                      accessibilityRole="button"
                      disabled={ocupado}
                      onPress={() => enviarEnlaceWeb([pedido])}
                      className={`h-12 flex-row items-center gap-2 rounded-xl border-2 border-emerald-700 bg-emerald-700 px-4 active:scale-[0.97] ${
                        ocupado ? 'opacity-40' : ''
                      }`}
                    >
                      <Globe size={18} color={colors.white} strokeWidth={2.5} />
                      <Text className="text-base font-bold text-white">Enviar enlace</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {lista.length > 0 && (
        <View
          className="absolute inset-x-0 bottom-0 gap-2.5 border-t border-slate-200 bg-milk px-4 pt-3 shadow-2xl"
          style={{ paddingBottom: insets.bottom + 10 }}
        >
          <Text className="text-center text-sm font-semibold text-slate-600">
            {elegidos.length === 0
              ? 'Elige los pedidos que quieres enviar'
              : `${plural(elegidos.length, 'pedido elegido', 'pedidos elegidos')} · ${plural(
                  elegidos.reduce((total, pedido) => total + unidades(pedido), 0),
                  'unidad',
                  'unidades',
                )}`}
          </Text>

          {/* Botón principal: Enlace web interactivo */}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                variant="success"
                size="lg"
                icon={Globe}
                label={elegidos.length > 1 ? `Enviar Enlace Web (${elegidos.length})` : 'Enviar Enlace Web'}
                loading={ocupado}
                disabled={elegidos.length === 0}
                onPress={() => enviarEnlaceWeb(elegidos)}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copiar enlace del panel de supervisión"
              disabled={elegidos.length === 0}
              onPress={copiarEnlaceWeb}
              className={`h-16 w-14 items-center justify-center rounded-xl border-2 border-emerald-700 bg-white active:bg-emerald-50 ${
                elegidos.length === 0 ? 'opacity-40' : ''
              }`}
            >
              <Copy size={24} color={colors.emerald[700]} strokeWidth={2.5} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir panel web en el navegador"
              disabled={elegidos.length === 0}
              onPress={abrirNavegador}
              className={`h-16 w-14 items-center justify-center rounded-xl border-2 border-brand bg-white active:bg-brand-50 ${
                elegidos.length === 0 ? 'opacity-40' : ''
              }`}
            >
              <ExternalLink size={24} color={colors.brand.DEFAULT} strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Opciones secundarias / fallback */}
          <View className="flex-row items-center justify-between pt-1">
            <Pressable
              onPress={copiarTextoPlano}
              disabled={elegidos.length === 0}
              className="flex-row items-center gap-1.5 py-1"
            >
              <Copy size={15} color={colors.slate[500]} />
              <Text className="text-xs font-semibold text-slate-500">Copiar texto plano</Text>
            </Pressable>

            <Pressable
              onPress={() => enviarTextoWhatsApp(elegidos)}
              disabled={ocupado || elegidos.length === 0}
              className="flex-row items-center gap-1.5 py-1"
            >
              <MessageCircle size={15} color={colors.slate[500]} />
              <Text className="text-xs font-semibold text-slate-500">Enviar texto tradicional</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Toast feedback={feedback} onClose={cerrar} />
    </View>
  );
}

function Casilla({ marcada }: { marcada: boolean }) {
  return (
    <View
      className={`h-9 w-9 items-center justify-center rounded-lg border-2 ${
        marcada ? 'border-brand bg-brand' : 'border-slate-400 bg-white'
      }`}
    >
      {marcada && <Check size={22} color={colors.white} strokeWidth={3.5} />}
    </View>
  );
}

function Resumen({ valor, etiqueta, alerta = false }: { valor: number; etiqueta: string; alerta?: boolean }) {
  return (
    <View className="flex-1 rounded-2xl border border-slate-200 bg-milk px-4 py-3">
      <Text className={`text-4xl font-extrabold ${alerta ? 'text-accent' : 'text-slate-900'}`}>{valor}</Text>
      <Text className="text-lg font-semibold text-slate-600">{etiqueta}</Text>
    </View>
  );
}
