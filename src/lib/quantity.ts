/** Texto del input numérico -> entero >= 0 (vacío o basura = 0). */
export const toQuantity = (text: string) => Number.parseInt(text.replace(/\D/g, ''), 10) || 0;
