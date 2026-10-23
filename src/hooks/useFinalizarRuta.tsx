import { useState } from 'react';

import { Dialog } from '@/components/Dialog';
import { Flag, Trash } from '@/lib/icons';
import { pedidosDeRuta, sinEnviar } from '@/lib/rutas';
import { useStore } from '@/store/useStore';
import type { RutaConcluida } from '@/types';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * "Finalizar ruta": cierra la ruta en curso y BORRA los pedidos de sus tiendas. Como no se puede deshacer, hay dos
 * confirmaciones: la primera resume la ruta; la segunda (solo si hay pedidos) avisa de que se borran y cuántos
 * no se habían enviado. Devuelve `abrir` y el `dialogo`, que quien lo use debe dibujar en su pantalla.
 */
export function useFinalizarRuta(onFinalizada?: (ruta: RutaConcluida) => void) {
  const rutaActiva = useStore((s) => s.rutaActiva);
  const pedidos = useStore((s) => s.pedidos);
  const finalizarRuta = useStore((s) => s.finalizarRuta);
  const [paso, setPaso] = useState<0 | 1 | 2>(0);

  const nombre = rutaActiva?.nombre ?? '';
  const deLaRuta = rutaActiva ? pedidosDeRuta(pedidos, nombre) : [];
  const pendientes = sinEnviar(deLaRuta).length;
  const atendidas = rutaActiva?.atendidas.length ?? 0;

  const cerrar = () => setPaso(0);
  const finalizar = () => {
    setPaso(0);
    const concluida = finalizarRuta();
    if (concluida) onFinalizada?.(concluida);
  };

  const dialogo =
    paso === 2 ? (
      <Dialog
        visible
        tone="danger"
        icon={Trash}
        title="Se borrarán los pedidos"
        message={`Vas a borrar ${plural(deLaRuta.length, 'pedido', 'pedidos')} de ${nombre}. ${
          pendientes > 0
            ? `${pendientes === 1 ? 'Hay 1 sin enviar' : `Hay ${pendientes} sin enviar`} y se perderá${pendientes === 1 ? '' : 'n'} para siempre.`
            : 'Todos ya fueron enviados.'
        } Esto no se puede deshacer.`}
        actions={[
          { label: 'No, volver', variant: 'secondary', onPress: cerrar },
          { label: 'Sí, borrar y finalizar', variant: 'danger', icon: Trash, onPress: finalizar },
        ]}
        onClose={cerrar}
      />
    ) : (
      <Dialog
        visible={paso === 1}
        tone="warning"
        icon={Flag}
        title={`¿Finalizar ${nombre}?`}
        message={`${atendidas > 0 ? `Atendiste ${plural(atendidas, 'tienda', 'tiendas')}. ` : ''}${
          deLaRuta.length > 0
            ? `Al finalizar se borran los ${deLaRuta.length === 1 ? 'datos del pedido' : `${deLaRuta.length} pedidos`} de esta ruta.`
            : 'No hay pedidos en esta ruta.'
        } La próxima vez que la inicies empieza de cero.`}
        actions={[
          { label: 'Seguir en la ruta', variant: 'secondary', onPress: cerrar },
          deLaRuta.length > 0
            ? { label: 'Continuar', variant: 'warning', onPress: () => setPaso(2) }
            : { label: 'Finalizar ruta', variant: 'warning', icon: Flag, onPress: finalizar },
        ]}
        onClose={cerrar}
      />
    );

  return { abrir: () => rutaActiva && setPaso(1), dialogo };
}
