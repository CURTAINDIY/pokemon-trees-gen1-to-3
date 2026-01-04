// src/lib/gen1/gen1.ts
// Gen 1 (RBY) save parsing with robust detection
// Saves are 32KB (0x8000 bytes)

import { gen1IndexToNatDex } from "./gen1_index_to_natdex";
import type { Gen1BoxMon } from "../types";

export const GEN1_SAVE_SIZE = 0x8000; // 32KB

// Gen 1 signature: Check for known trainer name location and checksum patterns
// Gen 1 saves have checksums at specific locations
const GEN1_CHECKSUM_LOC = 0x3523; // Main data checksum in Gen 1
const GEN1_PLAYER_NAME_LOC = 0x2598;

function readU16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

function readU24BE(b: Uint8Array, o: number): number {
  return (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
}

function normalizeGen1Save(raw: Uint8Array): Uint8Array {
  if (raw.length === 0x8000) return raw;
  if (raw.length === 0x10000) {
    // Some emulators create 64KB files with data duplicated
    return raw.slice(0x8000);
  }
  if (raw.length > 0x8000) {
    return raw.slice(raw.length - 0x8000);
  }
  return raw;
}

function computeGen1Checksum(data: Uint8Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum = (sum + data[i]) & 0xff;
  }
  return (~sum + 1) & 0xff;
}

// Gen 1 box structure
const BOX_SIZE = 0x462;
const BOX_COUNT_OFF = 0;
const BOX_SPECIES_OFF = 1;
const BOX_MONS_OFF = 0x16;
// const BOX_NICK_OFF = 0x386;  // Unused currently
const MON_SIZE = 33;

export function detectGen1Save(raw: Uint8Array): boolean {
  const data = normalizeGen1Save(raw);
  if (data.length !== 0x8000) {
    console.log(`[Gen1 Detection] Invalid size: ${data.length}`);
    return false;
  }

  // Check main data checksum
  const storedChecksum = data[GEN1_CHECKSUM_LOC];
  const calculatedChecksum = computeGen1Checksum(data, 0x2598, 0x3523);
  
  console.log(`[Gen1 Detection] Checksum - stored: 0x${storedChecksum.toString(16)}, calculated: 0x${calculatedChecksum.toString(16)}`);

  // Check for valid player name (should be terminated with 0x50 or contain valid Gen1 text chars)
  const playerNameRegion = data.slice(GEN1_PLAYER_NAME_LOC, GEN1_PLAYER_NAME_LOC + 11);
  console.log(`[Gen1 Detection] Player name bytes:`, Array.from(playerNameRegion).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
  
  let hasValidNameChar = false;
  for (let i = 0; i < playerNameRegion.length; i++) {
    const c = playerNameRegion[i];
    if (c === 0x50) break; // terminator
    // Valid Gen1 text characters are typically 0x80-0xF6
    if ((c >= 0x80 && c <= 0xF6) || c === 0x50) {
      hasValidNameChar = true;
      break;
    }
  }

  console.log(`[Gen1 Detection] Valid name char found: ${hasValidNameChar}`);

  // Look for PC box structures at known Gen1 locations
  // Gen 1 has boxes in two banks: 0x4000 and 0x6000
  const boxLocations = [0x4000, 0x6000];
  
  let foundValidBox = false;
  for (const loc of boxLocations) {
    const isValid = looksLikeGen1Box(data, loc);
    console.log(`[Gen1 Detection] Box at 0x${loc.toString(16)}: ${isValid ? 'VALID' : 'invalid'}`);
    if (isValid) {
      foundValidBox = true;
      break;
    }
  }

  // Accept as Gen1 if we found valid box structures, even if player name check failed
  // (Some saves might have corrupted name region but valid Pokemon data)
  if (foundValidBox) {
    console.log(`[Gen1 Detection] ✅ Detected as Gen 1 save (box structure valid)`);
    return true;
  }

  console.log(`[Gen1 Detection] ❌ Not detected as Gen 1 save`);
  return false;
}

function looksLikeGen1Box(data: Uint8Array, offset: number): boolean {
  if (offset + BOX_SIZE > data.length) return false;

  const count = data[offset + BOX_COUNT_OFF];
  if (count > 20) return false;

  // Check species list terminator
  if (data[offset + BOX_SPECIES_OFF + 20] !== 0xFF) return false;

  // Validate species indices map to known Pokemon
  for (let i = 0; i < count; i++) {
    const speciesIdx = data[offset + BOX_SPECIES_OFF + i];
    if (speciesIdx === 0 || speciesIdx === 0xFF) return false;
    
    const natDex = gen1IndexToNatDex[speciesIdx];
    if (natDex === 0 || natDex === undefined) return false; // Unknown species
  }

  return true;
}

export function extractGen1BoxMons(raw: Uint8Array): Gen1BoxMon[] {
  const data = normalizeGen1Save(raw);
  if (data.length !== 0x8000) {
    throw new Error("Invalid Gen 1 save size");
  }

  const mons: Gen1BoxMon[] = [];
  
  // Gen 1 save structure:
  // - 0x30C0: Current box (the box you have open in-game, 0x462 bytes)
  // - 0x284A: Current box number (0-11 for boxes 1-12)
  // - 0x4000-0x5FFF: SRAM Bank 0 (boxes 1-6, but bank-switched)
  // - 0x6000-0x7FFF: SRAM Bank 1 (boxes 7-12, but bank-switched)
  // 
  // IMPORTANT: Gen 1 uses bank-switched SRAM. The currently selected box
  // is stored at 0x30C0, NOT in the SRAM banks. We must extract from both
  // the current box AND all SRAM bank locations.
  
  console.log("\n=== Gen 1 Box Extraction ===");
  
  const currentBoxNum = data[0x284A];
  console.log(`Current box selected: Box ${currentBoxNum + 1}`);
  
  // First, extract the current box (the one selected in-game)
  const currentBoxMons = parseGen1Box(data, 0x30C0, `Current Box (Box ${currentBoxNum + 1})`);
  if (currentBoxMons.length > 0) {
    console.log(`Current Box (Box ${currentBoxNum + 1}) at 0x30C0: ${currentBoxMons.length} Pokemon - ${currentBoxMons.map(m => `#${m.natDex} Lv${m.level}`).join(', ')}`);
  } else {
    console.log(`Current Box (Box ${currentBoxNum + 1}) at 0x30C0: No valid Pokemon found`);
  }
  mons.push(...currentBoxMons);
  
  // Then scan all potential box locations in both SRAM banks
  const boxBases = [
    { offset: 0x4000, label: "SRAM Bank 0 - Box 1" },
    { offset: 0x4000 + BOX_SIZE * 1, label: "SRAM Bank 0 - Box 2" },
    { offset: 0x4000 + BOX_SIZE * 2, label: "SRAM Bank 0 - Box 3" },
    { offset: 0x4000 + BOX_SIZE * 3, label: "SRAM Bank 0 - Box 4" },
    { offset: 0x4000 + BOX_SIZE * 4, label: "SRAM Bank 0 - Box 5" },
    { offset: 0x4000 + BOX_SIZE * 5, label: "SRAM Bank 0 - Box 6" },
    { offset: 0x6000, label: "SRAM Bank 1 - Box 7" },
    { offset: 0x6000 + BOX_SIZE * 1, label: "SRAM Bank 1 - Box 8" },
    { offset: 0x6000 + BOX_SIZE * 2, label: "SRAM Bank 1 - Box 9" },
    { offset: 0x6000 + BOX_SIZE * 3, label: "SRAM Bank 1 - Box 10" },
    { offset: 0x6000 + BOX_SIZE * 4, label: "SRAM Bank 1 - Box 11" },
    { offset: 0x6000 + BOX_SIZE * 5, label: "SRAM Bank 1 - Box 12" },
  ];

  for (const { offset, label } of boxBases) {
    if (offset + BOX_SIZE > data.length) {
      console.log(`${label}: skipped (exceeds save size)`);
      continue;
    }
    
    const boxMons = parseGen1Box(data, offset, label);
    if (boxMons.length > 0) {
      console.log(`${label} (0x${offset.toString(16)}): ${boxMons.length} Pokemon - ${boxMons.map(m => `#${m.natDex} Lv${m.level}`).join(', ')}`);
      mons.push(...boxMons);
    }
  }
  
  console.log(`Total Gen 1 Pokemon extracted: ${mons.length}`);
  console.log("============================\n");

  return mons;
}

function parseGen1Box(data: Uint8Array, base: number, label?: string): Gen1BoxMon[] {
  const mons: Gen1BoxMon[] = [];
  const count = data[base + BOX_COUNT_OFF];
  
  if (count > 20) {
    if (label) console.log(`  ${label}: Invalid count (${count}>20), skipping`);
    return mons;
  }
  
  if (count === 0) {
    return mons; // Empty box, no log needed
  }

  for (let i = 0; i < count; i++) {
    const speciesIndex = data[base + BOX_SPECIES_OFF + i];
    
    if (speciesIndex === 0 || speciesIndex === 0xFF) {
      continue; // Empty slot
    }

    const monOff = base + BOX_MONS_OFF + i * MON_SIZE;
    const raw33 = data.slice(monOff, monOff + MON_SIZE);

    // Parse boxed mon structure
    const internalSpecies = raw33[0]; // Species byte inside the Pokemon data
    // const hp = readU16BE(raw33, 1);  // Unused
    const level = raw33[3];
    // const status = raw33[4];  // Unused
    // const type1 = raw33[5];  // Unused
    // const type2 = raw33[6];  // Unused
    // const catchRate = raw33[7];  // Unused
    const moves = [raw33[8], raw33[9], raw33[10], raw33[11]] as [number, number, number, number];
    const otId16 = readU16BE(raw33, 12);
    const exp = readU24BE(raw33, 14);
    
    // Get species names for debugging
    const boxSpeciesNatDex = gen1IndexToNatDex[speciesIndex];
    const internalSpeciesNatDex = gen1IndexToNatDex[internalSpecies];
    const boxSpeciesName = boxSpeciesNatDex ? `#${boxSpeciesNatDex}` : `Unknown(${speciesIndex})`;
    const internalSpeciesName = internalSpeciesNatDex ? `#${internalSpeciesNatDex}` : `Unknown(${internalSpecies})`;
    
    // Check for species mismatch (box list vs internal data)
    // This can happen with certain glitches or cloning
    // We'll trust the box list species (what player sees) but warn if they differ
    if (speciesIndex !== internalSpecies) {
      console.log(`  [Species Mismatch] Slot ${i+1}: Box=${boxSpeciesName}, Internal=${internalSpeciesName}, Level=${level}, Exp=${exp}`);
      
      // Only skip if BOTH species are invalid/unknown
      const boxSpeciesValid = boxSpeciesNatDex !== 0 && boxSpeciesNatDex !== undefined;
      const internalSpeciesValid = internalSpeciesNatDex !== 0 && internalSpeciesNatDex !== undefined;
      
      if (!boxSpeciesValid && !internalSpeciesValid) {
        console.log(`    → REJECTED: Both species unknown`);
        continue; // Both species unknown - definitely corrupted
      }
      
      if (!boxSpeciesValid) {
        console.log(`    → REJECTED: Box species invalid`);
        continue; // Box list species invalid - can't determine what Pokemon this is
      }
      
      // If we get here, box species is valid, so trust it (even if internal species differs)
      // This is common with certain Gen 1 glitches and shouldn't prevent extraction
      console.log(`    → ACCEPTED: Trusting box species ${boxSpeciesName}`);
    }
    // const hpEV = readU16BE(raw33, 17);  // Unused
    // const atkEV = readU16BE(raw33, 19);  // Unused
    // const defEV = readU16BE(raw33, 21);  // Unused
    // const speEV = readU16BE(raw33, 23);  // Unused
    // const spcEV = readU16BE(raw33, 25);  // Unused
    const dvs = readU16BE(raw33, 27);
    const pps = [raw33[29], raw33[30], raw33[31], raw33[32]] as [number, number, number, number];

    const natDex = gen1IndexToNatDex[speciesIndex];
    
    if (natDex === 0 || natDex === undefined) {
      console.log(`  [Unknown Species] Slot ${i+1}: Species index ${speciesIndex} - REJECTED`);
      continue; // Unknown species, skip
    }

    // Validation: Skip obviously corrupted/glitched Pokemon
    // Level must be 1-100
    if (level < 1 || level > 100) {
      console.log(`  [Invalid Level] ${boxSpeciesName} Lv${level} - REJECTED (must be 1-100)`);
      continue;
    }
    
    // EXP must be reasonable for the level
    // Catch absurd EXP values that indicate corruption
    if (exp > 2000000) {
      console.log(`  [Excessive EXP] ${boxSpeciesName} Lv${level} Exp=${exp} - REJECTED (>2M)`);
      continue; // Max legit Gen 1 exp is ~1.6M (Slow growth to level 100)
    }
    
    // Low level Pokemon shouldn't have extreme EXP
    if (level <= 10 && exp > 10000) {
      console.log(`  [EXP Too High For Level] ${boxSpeciesName} Lv${level} Exp=${exp} - REJECTED`);
      continue;
    }
    
    // Legendaries at level 10 or below are suspicious (they're caught at higher levels)
    // Mewtwo, Articuno, Zapdos, Moltres are caught at level 50+
    if ((natDex === 144 || natDex === 145 || natDex === 146 || natDex === 150) && level < 40) {
      console.log(`  [Low-Level Legendary] ${boxSpeciesName} Lv${level} - REJECTED (legendary must be ≥40)`);
      continue; // Likely glitched/corrupted legendary
    }
    
    // Skip if all moves are 0
    if (moves[0] === 0 && moves[1] === 0 && moves[2] === 0 && moves[3] === 0) {
      console.log(`  [No Moves] ${boxSpeciesName} Lv${level} - REJECTED (all moves are 0)`);
      continue;
    }

    mons.push({
      raw33,
      speciesIndex,
      natDex,
      otId16,
      exp,
      level,
      moves,
      pps,
      dvs,
    });
  }

  return mons;
}