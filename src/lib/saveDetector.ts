// src/lib/saveDetector.ts
// Detect save file generation

import { detectGen1Save } from './gen1/gen1';
import { detectGen2Save } from './gen2/gen2';
import { detectGen3Save } from './gen3/gen3';
import type { SaveType } from './types';

export type SaveSystem = "GB/GBC" | "GBA" | "NDS" | "Unknown";

/**
 * Detect console generation from save file size (heuristic).
 * Useful for UI labels and quick classification before deep parsing.
 * Note: This is a rough heuristic; actual detection comes from parsing.
 */
export function detectSystemFromSaveSize(sizeBytes: number): SaveSystem {
  if (sizeBytes <= 0) return "Unknown";

  // NDS tends to be >= 512KB
  if (sizeBytes >= 512 * 1024) return "NDS";

  // GBA common sizes: 64KB, 128KB, 256KB
  if (sizeBytes === 64 * 1024 || sizeBytes === 128 * 1024 || sizeBytes === 256 * 1024) {
    return "GBA";
  }

  // GB/GBC common sizes: 8KB, 32KB, 64KB, 128KB
  if (
    sizeBytes === 8 * 1024 ||
    sizeBytes === 32 * 1024 ||
    sizeBytes === 64 * 1024 ||
    sizeBytes === 128 * 1024
  ) {
    return "GB/GBC";
  }

  // If it's >= 128KB but < 512KB, it's more likely GBA than GB/GBC
  if (sizeBytes > 128 * 1024 && sizeBytes < 512 * 1024) return "GBA";

  // Small unknowns: call it GB/GBC-ish
  if (sizeBytes < 128 * 1024) return "GB/GBC";

  return "Unknown";
}

export function detectSaveType(data: Uint8Array): SaveType {
  // Try Gen 3 first (128KB)
  if (data.length === 0x20000 && detectGen3Save(data)) {
    return 'gen3';
  }
  
  // Try Gen 1/2 (both ~32KB, need careful detection)
  // Support files with headers/footers (typically 32768 bytes ± some padding)
  if ((data.length >= 0x8000 && data.length <= 0x8200) || data.length === 0x10000) {
    // Gen 1 has more specific signatures, try it first
    if (detectGen1Save(data)) {
      return 'gen1';
    }
    
    // Try Gen 2
    if (detectGen2Save(data)) {
      return 'gen2';
    }
  }
  
  return 'unknown';
}
