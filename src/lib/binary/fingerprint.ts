// src/lib/binary/fingerprint.ts
//
// Stable fingerprint helper for de-duplication.
// Uses WebCrypto (available in modern browsers and Vite dev server).

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Normalize Uint8Array for WebCrypto API compatibility
  const safeBytes = new Uint8Array(bytes);
  const buf = await crypto.subtle.digest("SHA-256", safeBytes);
  const arr = new Uint8Array(buf);
  let out = "";
  for (const b of arr) out += b.toString(16).padStart(2, "0");
  return out;
}
