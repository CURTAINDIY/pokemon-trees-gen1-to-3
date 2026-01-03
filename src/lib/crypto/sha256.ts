// src/lib/crypto/sha256.ts
// SHA-256 hex digest with FNV-1a fallback for insecure contexts.
// Works in modern browsers (and in Vite builds targeting evergreen browsers).
// Falls back to 64-bit FNV-1a when crypto.subtle isn't available (e.g., HTTP on mobile).

/**
 * SHA-256 hex digest when available (secure contexts),
 * with a stable non-crypto fallback for insecure contexts
 * (ex: Android browser over http://192.168.x.x).
 */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;

  if (subtle?.digest) {
    // Use crypto.subtle when available
    const safeData = new Uint8Array(data);
    const digest = await subtle.digest("SHA-256", safeData);
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      const h = bytes[i].toString(16).padStart(2, "0");
      hex += h;
    }
    return hex;
  }

  // Fallback: 64-bit FNV-1a (stable, NOT cryptographic)
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < data.length; i++) {
    hash ^= BigInt(data[i]);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}
