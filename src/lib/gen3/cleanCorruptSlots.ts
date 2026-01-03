// src/lib/gen3/cleanCorruptSlots.ts
//
// Utility to clean corrupt Pokemon slots from Gen 3 save files.
// This prevents game crashes when opening boxes containing corrupt Pokemon.
//
// IMPORTANT: This does NOT "compact" boxes or shift slots around.
// It only zeroes out slots that fail PK3 checksum validation.

import { extractGen3BoxMons, injectGen3BoxMons, GEN3_SAVE_SIZE } from './gen3';
import { decodePk3 } from './pk3';

export interface CleanCorruptSlotsResult {
  bytes: Uint8Array;
  cleared: number;
  totalScanned: number;
  report: string;
}

/**
 * Clean corrupt Pokemon slots from a Gen 3 save file.
 * 
 * Scans all PC boxes and zeroes out any slots that:
 * - Are not empty (PID != 0)
 * - Fail PK3 checksum validation
 * 
 * This is useful for:
 * - Recovering corrupted save files
 * - Preventing game crashes from bad Pokemon data
 * - Cleaning up after failed injection attempts
 * 
 * @param saveBytes - Original Gen 3 save file (128KB)
 * @returns Result with cleaned save, count of cleared slots, and diagnostic report
 */
export function cleanGen3PcCorruptSlots(saveBytes: Uint8Array): CleanCorruptSlotsResult {
  if (saveBytes.length !== GEN3_SAVE_SIZE) {
    throw new Error(`Invalid save size: expected ${GEN3_SAVE_SIZE} bytes, got ${saveBytes.length}`);
  }

  // Extract all Pokemon from PC
  let allMons: Array<{ box: number; slot: number; raw80: Uint8Array }>;
  try {
    allMons = extractGen3BoxMons(saveBytes);
  } catch (err) {
    throw new Error(`Failed to extract Pokemon from save: ${err instanceof Error ? err.message : String(err)}`);
  }

  const totalScanned = allMons.length;
  let cleared = 0;
  const corruptSlots: Array<{ box: number; slot: number; reason: string }> = [];
  
  // Check each Pokemon and identify corrupt ones
  const validMons: Array<{ box: number; slot: number; raw80: Uint8Array }> = [];
  
  for (const mon of allMons) {
    try {
      const decoded = decodePk3(mon.raw80);
      
      if (!decoded.checksumOk) {
        corruptSlots.push({
          box: mon.box,
          slot: mon.slot,
          reason: `Checksum mismatch (stored: 0x${decoded.checksumStored.toString(16)}, calculated: 0x${decoded.checksumCalculated.toString(16)})`
        });
        cleared++;
      } else {
        validMons.push(mon);
      }
    } catch (err) {
      // If decoding fails entirely, mark as corrupt
      corruptSlots.push({
        box: mon.box,
        slot: mon.slot,
        reason: `Decode failed: ${err instanceof Error ? err.message : String(err)}`
      });
      cleared++;
    }
  }

  // Generate report
  const report = generateCleanupReport(totalScanned, cleared, corruptSlots);

  // If no corrupt slots found, return original save
  if (cleared === 0) {
    return {
      bytes: saveBytes,
      cleared: 0,
      totalScanned,
      report
    };
  }

  // Create new save with only valid Pokemon
  // We do this by extracting valid mons and re-injecting into a clean copy
  const cleanedSave = new Uint8Array(saveBytes);
  
  // Zero out ALL Pokemon slots first (create clean slate)
  const emptyMons = extractGen3BoxMons(cleanedSave);
  const emptySlots = emptyMons.map(m => ({ box: m.box, slot: m.slot, raw80: new Uint8Array(80) }));
  const withEmpty = injectGen3BoxMons(cleanedSave, emptySlots);
  
  // Now inject only the valid Pokemon
  const result = injectGen3BoxMons(withEmpty, validMons);

  return {
    bytes: result,
    cleared,
    totalScanned,
    report
  };
}

function generateCleanupReport(
  totalScanned: number,
  cleared: number,
  corruptSlots: Array<{ box: number; slot: number; reason: string }>
): string {
  const lines: string[] = [];
  
  lines.push('=== Gen 3 PC Corruption Cleanup Report ===');
  lines.push('');
  lines.push(`Total Pokemon scanned: ${totalScanned}`);
  lines.push(`Corrupt slots cleared: ${cleared}`);
  lines.push(`Valid Pokemon preserved: ${totalScanned - cleared}`);
  lines.push('');
  
  if (cleared === 0) {
    lines.push('✅ No corrupt Pokemon found. Save file is clean!');
  } else {
    lines.push(`⚠️ Found ${cleared} corrupt Pokemon:`);
    lines.push('');
    
    for (const slot of corruptSlots) {
      lines.push(`  Box ${slot.box + 1}, Slot ${slot.slot + 1}: ${slot.reason}`);
    }
    
    lines.push('');
    lines.push('These slots have been zeroed out to prevent game crashes.');
  }
  
  return lines.join('\n');
}

/**
 * Check if a Gen 3 save has any corrupt Pokemon slots.
 * This is a non-destructive check that doesn't modify the save.
 * 
 * @param saveBytes - Gen 3 save file to check
 * @returns Object with corruption status and count
 */
export function detectCorruptSlots(saveBytes: Uint8Array): {
  hasCorruption: boolean;
  corruptCount: number;
  totalCount: number;
} {
  if (saveBytes.length !== GEN3_SAVE_SIZE) {
    throw new Error(`Invalid save size: expected ${GEN3_SAVE_SIZE} bytes, got ${saveBytes.length}`);
  }

  try {
    const allMons = extractGen3BoxMons(saveBytes);
    let corruptCount = 0;

    for (const mon of allMons) {
      try {
        const decoded = decodePk3(mon.raw80);
        if (!decoded.checksumOk) {
          corruptCount++;
        }
      } catch {
        corruptCount++;
      }
    }

    return {
      hasCorruption: corruptCount > 0,
      corruptCount,
      totalCount: allMons.length
    };
  } catch (err) {
    throw new Error(`Failed to check for corruption: ${err instanceof Error ? err.message : String(err)}`);
  }
}
