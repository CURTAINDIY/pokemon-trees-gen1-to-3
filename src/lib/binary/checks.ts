// src/lib/binary/checks.ts
// Binary data validation utilities

/**
 * Check if all bytes in a Uint8Array are zero.
 * Useful for detecting empty slots, null data, or uninitialized memory.
 */
export function isAllZero(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

/**
 * Check if all bytes in a Uint8Array match a specific value.
 */
export function isAllValue(bytes: Uint8Array, value: number): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== value) return false;
  }
  return true;
}

/**
 * Check if bytes contain only printable ASCII characters (0x20-0x7E).
 * Useful for detecting text data vs binary data.
 */
export function isPrintableAscii(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x20 || b > 0x7e) return false;
  }
  return true;
}
