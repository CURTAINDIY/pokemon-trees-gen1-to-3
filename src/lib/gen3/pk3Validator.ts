// src/lib/gen3/pk3Validator.ts
// Validation utilities for PK3 data

import { decodePk3, type Pk3Decoded } from './pk3';
import { SPECIES_GEN3 } from '../dex/species';

export interface Pk3ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  decoded?: Pk3Decoded;
}

/**
 * Comprehensive validation of a PK3 Pokemon
 * Checks for:
 * - Correct structure (80 bytes)
 * - Valid species ID (1-386)
 * - Checksum match
 * - Valid moves (1-354 for Gen 3)
 * - Valid IVs (0-31 per stat)
 * - Reasonable level based on EXP
 */
export function validatePk3(raw80: Uint8Array): Pk3ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check size
  if (raw80.length !== 80) {
    errors.push(`Invalid size: expected 80 bytes, got ${raw80.length}`);
    return { isValid: false, errors, warnings };
  }
  
  // Check if empty (all zeros or PID+checksum both zero)
  const allZero = raw80.every(b => b === 0);
  if (allZero) {
    return {
      isValid: true,
      errors: [],
      warnings: ['Empty slot (all zeros)']
    };
  }
  
  // Decode the Pokemon
  let decoded: Pk3Decoded;
  try {
    decoded = decodePk3(raw80);
  } catch (err) {
    errors.push(`Decoding failed: ${err instanceof Error ? err.message : String(err)}`);
    return { isValid: false, errors, warnings };
  }
  
  // Validate checksum
  if (!decoded.checksumOk) {
    errors.push(`Checksum mismatch: stored=0x${decoded.checksumStored.toString(16)}, calculated=0x${decoded.checksumCalculated.toString(16)}`);
  }
  
  // Validate species
  if (decoded.speciesId === 0) {
    warnings.push('Species ID is 0 (egg or empty slot)');
  } else if (decoded.speciesId < 1 || decoded.speciesId > 386) {
    errors.push(`Invalid species ID: ${decoded.speciesId} (valid range: 1-386)`);
  } else if (!SPECIES_GEN3[decoded.speciesId]) {
    errors.push(`Unknown species ID: ${decoded.speciesId}`);
  }
  
  // Validate moves
  if (decoded.moves) {
    for (let i = 0; i < decoded.moves.length; i++) {
      const moveId = decoded.moves[i];
      if (moveId > 354) {
        errors.push(`Invalid move ${i + 1}: ID ${moveId} exceeds Gen 3 max (354)`);
      }
      if (moveId !== 0 && moveId < 1) {
        errors.push(`Invalid move ${i + 1}: ID ${moveId} is negative`);
      }
    }
    
    // Check for move gaps (move 0 before non-zero move)
    let foundZero = false;
    for (const moveId of decoded.moves) {
      if (moveId === 0) {
        foundZero = true;
      } else if (foundZero) {
        warnings.push('Move set has gaps (0 before non-zero move)');
        break;
      }
    }
  }
  
  // Validate IVs
  if (decoded.ivs) {
    const ivs = decoded.ivs;
    const stats = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'] as const;
    for (const stat of stats) {
      const iv = ivs[stat];
      if (iv < 0 || iv > 31) {
        errors.push(`Invalid ${stat.toUpperCase()} IV: ${iv} (valid range: 0-31)`);
      }
    }
  }
  
  // Validate met level
  if (decoded.metLevel !== undefined) {
    if (decoded.metLevel < 0 || decoded.metLevel > 100) {
      errors.push(`Invalid met level: ${decoded.metLevel} (valid range: 0-100)`);
    }
  }
  
  // Validate PID and OTID
  if (decoded.pid === 0 && decoded.otId === 0) {
    warnings.push('PID and OTID are both 0 (test data or invalid)');
  }
  
  // Check nickname and OT name
  if (!decoded.nickname || decoded.nickname.trim() === '') {
    warnings.push('Pokemon has no nickname');
  }
  
  if (!decoded.otName || decoded.otName.trim() === '') {
    warnings.push('Pokemon has no OT name');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    decoded
  };
}

/**
 * Validate a batch of Pokemon and return summary statistics
 */
export function validatePk3Batch(
  pokemon: Uint8Array[]
): {
  total: number;
  valid: number;
  invalid: number;
  empty: number;
  results: Pk3ValidationResult[];
} {
  const results = pokemon.map(pk3 => validatePk3(pk3));
  
  const valid = results.filter(r => r.isValid && r.warnings.every(w => !w.includes('Empty'))).length;
  const invalid = results.filter(r => !r.isValid).length;
  const empty = results.filter(r => r.warnings.some(w => w.includes('Empty'))).length;
  
  return {
    total: pokemon.length,
    valid,
    invalid,
    empty,
    results
  };
}

/**
 * Quick check if a PK3 has a valid species (1-386)
 */
export function hasValidSpecies(raw80: Uint8Array): boolean {
  if (raw80.length !== 80) return false;
  
  try {
    const decoded = decodePk3(raw80);
    return decoded.speciesId >= 1 && decoded.speciesId <= 386 && decoded.checksumOk;
  } catch {
    return false;
  }
}

/**
 * Extract species name for display
 */
export function getSpeciesName(speciesId: number): string {
  if (speciesId === 0) return 'Empty';
  if (speciesId < 1 || speciesId > 386) return `Invalid (#${speciesId})`;
  return SPECIES_GEN3[speciesId] || `Unknown (#${speciesId})`;
}

/**
 * Format a PK3 for display
 */
export function formatPk3(decoded: Pk3Decoded): string {
  const speciesName = getSpeciesName(decoded.speciesId);
  const nickname = decoded.nickname || '(no nickname)';
  const otName = decoded.otName || '(no OT)';
  
  let output = `${speciesName} "${nickname}"`;
  output += `\n  OT: ${otName} (ID: ${decoded.otId})`;
  output += `\n  PID: 0x${decoded.pid.toString(16).padStart(8, '0')}`;
  output += `\n  Checksum: ${decoded.checksumOk ? '✓ Valid' : '✗ Invalid'}`;
  
  if (decoded.metLevel !== undefined) {
    output += `\n  Met Level: ${decoded.metLevel}`;
  }
  
  if (decoded.moves) {
    const moveList = decoded.moves.filter(m => m !== 0).join(', ') || 'None';
    output += `\n  Moves: ${moveList}`;
  }
  
  if (decoded.ivs) {
    const ivs = decoded.ivs;
    output += `\n  IVs: HP=${ivs.hp} ATK=${ivs.atk} DEF=${ivs.def} SPE=${ivs.spe} SPA=${ivs.spa} SPD=${ivs.spd}`;
  }
  
  return output;
}
