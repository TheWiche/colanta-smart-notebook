import { useCallback, useEffect, useState } from 'react';

import type { Feedback } from '@/components/Toast';

/** Estado del aviso flotante. Un éxito se oculta solo; un error se queda hasta cerrarlo o repetir la acción. */
export function useToast() {
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!feedback?.ok) return;
    const timer = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const cerrar = useCallback(() => setFeedback(null), []);
  return { feedback, mostrar: setFeedback, cerrar };
}
