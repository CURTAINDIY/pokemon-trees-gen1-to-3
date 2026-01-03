// src/lib/binary/hex.ts
// Hex encoding/decoding utilities

/**
 * Convert bytes to hexadecimal string.
 * Useful for debugging, logging, and displaying binary data.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Convert hexadecimal string to bytes.
 * Accepts both uppercase and lowercase hex.
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove any spaces or separators
  hex = hex.replace(/[\s:-]/g, "");
  
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even number of characters");
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i * 2}`);
    }
    bytes[i] = byte;
  }
  return bytes;
}
