// src/lib/binary/uuid.ts
// UUID v4 generator with crypto.getRandomValues fallback

/**
 * Generate a RFC 4122 version 4 UUID.
 * Uses crypto.getRandomValues when available, else falls back to Math.random.
 * Suitable for local IDs/keys in offline-first apps.
 */
export function uuid(): string {
  const crypto = globalThis.crypto;
  
  if (crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // RFC 4122 version 4 variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return (
      hex.slice(0, 8) + '-' +
      hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' +
      hex.slice(20)
    );
  }

  // Fallback for environments without crypto.getRandomValues
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}
