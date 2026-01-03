// src/lib/binary/download.ts

export function downloadBytes(
  bytes: Uint8Array, 
  filename: string, 
  options?: { expectedLen?: number; mime?: string }
) {
  const mime = options?.mime ?? "application/octet-stream";
  // Normalize Uint8Array for Blob API compatibility
  const safeBytes = new Uint8Array(bytes);
  const blob = new Blob([safeBytes], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.click();
  } finally {
    // Give the click a tick to start before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
}
