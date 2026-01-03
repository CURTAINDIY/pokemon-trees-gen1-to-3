// src/lib/crypto/fnv.ts
// FNV-1a hash functions (fast, non-cryptographic)
// Useful for quick checksums, debugging, and non-security contexts.

/**
 * 32-bit FNV-1a (fast, NOT cryptographic)
 * Good for quick hashing, checksums, and debugging.
 */
export function fnv1a32(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    // h *= 16777619 (with 32-bit overflow)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Returns a 32-bit FNV-1a hash as an 8-character hex string.
 */
export function fnv1a32Hex(bytes: Uint8Array): string {
  return fnv1a32(bytes).toString(16).padStart(8, "0");
}

/**
 * 64-bit FNV-1a (fast, NOT cryptographic)
 * Returns a BigInt for the full 64-bit hash.
 */
export function fnv1a64(bytes: Uint8Array): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= BigInt(bytes[i]);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash;
}

/**
 * Returns a 64-bit FNV-1a hash as a 16-character hex string.
 */
export function fnv1a64Hex(bytes: Uint8Array): string {
  return fnv1a64(bytes).toString(16).padStart(16, "0");
}
