// src/lib/binary/gbText.ts
// Gen 1 / Gen 2 Game Boy text decoding
//
// This decoder handles the proprietary text encoding used in Gen 1 (RBY) and Gen 2 (GSC).
// It focuses on the most common characters (A-Z, 0-9, space, punctuation) needed for
// displaying nicknames and OT names.

/**
 * Decode Game Boy text from Gen 1 or Gen 2 saves.
 * 
 * Gen 1/2 use a custom character encoding:
 * - 0x50: String terminator
 * - 0x7F: Space character
 * - 0x80-0x99: Uppercase A-Z (26 characters)
 * - 0xF6-0xFF: Digits 0-9 (varies by game)
 * - Various codes for punctuation
 * 
 * Unrecognized bytes are replaced with '?'.
 * 
 * @param bytes - The byte array containing encoded text
 * @param off - Starting offset in the byte array
 * @param len - Maximum length to decode
 * @returns Decoded string, trimmed of trailing spaces
 */
export function decodeGBText(bytes: Uint8Array, off: number, len: number): string {
  const out: string[] = [];
  
  for (let i = 0; i < len; i++) {
    const b = bytes[off + i] & 0xff;
    
    // String terminator - stop decoding
    if (b === 0x50) break;
    
    // Space character
    if (b === 0x7f) {
      out.push(' ');
      continue;
    }
    
    // Uppercase A-Z (0x80-0x99 = 26 characters)
    if (b >= 0x80 && b <= 0x99) {
      out.push(String.fromCharCode('A'.charCodeAt(0) + (b - 0x80)));
      continue;
    }
    
    // Digits 0-9 (best-effort; exact range varies by game version)
    // Most commonly 0xF6-0xFF in Gen 1/2
    if (b >= 0xf6 && b <= 0xff) {
      const d = b - 0xf6;
      if (d >= 0 && d <= 9) {
        out.push(String.fromCharCode('0'.charCodeAt(0) + d));
        continue;
      }
    }
    
    // Common punctuation
    if (b === 0xe6) {
      out.push('!');
      continue;
    }
    if (b === 0xe7) {
      out.push('?');
      continue;
    }
    if (b === 0xe8) {
      out.push('.');
      continue;
    }
    if (b === 0xe9) {
      out.push('…');
      continue;
    }
    if (b === 0xba) {
      out.push('-');
      continue;
    }
    
    // Lowercase a-z (Gen 2 adds lowercase support)
    // 0xA0-0xB9 in some versions
    if (b >= 0xa0 && b <= 0xb9) {
      out.push(String.fromCharCode('a'.charCodeAt(0) + (b - 0xa0)));
      continue;
    }
    
    // Unrecognized character - replace with '?'
    out.push('?');
  }
  
  return out.join('').trim();
}

/**
 * Decode GB text from a Uint8Array starting at offset 0.
 * Convenience wrapper for decodeGBText.
 */
export function decodeGBTextFromArray(bytes: Uint8Array): string {
  return decodeGBText(bytes, 0, bytes.length);
}
