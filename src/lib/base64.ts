/**
 * Codificador Base64 seguro para URL (RFC 4648 § 5) en TypeScript puro.
 * Funciona de manera idéntica en React Native (Hermes), Node.js y navegadores web.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function stringToBase64(input: string): string {
  let output = '';
  let chr1: number, chr2: number, chr3: number;
  let enc1: number, enc2: number, enc3: number, enc4: number;
  let i = 0;

  while (i < input.length) {
    chr1 = input.charCodeAt(i++);
    chr2 = input.charCodeAt(i++);
    chr3 = input.charCodeAt(i++);

    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = isNaN(chr2) ? 64 : ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = isNaN(chr2) || isNaN(chr3) ? 64 : chr3 & 63;

    output += CHARS.charAt(enc1) + CHARS.charAt(enc2) + CHARS.charAt(enc3) + CHARS.charAt(enc4);
  }

  return output;
}

/**
 * Convierte un string UTF-8 a Base64 apto para URLs (reemplaza + por -, / por _ y omite el padding =).
 */
export function toUrlSafeBase64(utf8String: string): string {
  const binaryString = encodeURIComponent(utf8String).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16)),
  );
  return stringToBase64(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

