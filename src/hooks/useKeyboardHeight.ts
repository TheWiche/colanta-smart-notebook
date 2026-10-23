import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Alto del teclado en pantalla (0 si está cerrado).
 *
 * Con edge-to-edge (siempre activo en Android desde SDK 55) la ventana ya no se redimensiona al abrir
 * el teclado, y `KeyboardAvoidingView` obliga a calcular a mano el alto del header. En una pantalla
 * que llega hasta el borde inferior basta con reservar este alto como padding.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
