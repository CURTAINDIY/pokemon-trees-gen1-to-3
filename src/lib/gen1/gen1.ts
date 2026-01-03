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
  if (data.length !== 0x8000) return false;

  // Check main data checksum
  const storedChecksum = data[GEN1_CHECKSUM_LOC];
  const calculatedChecksum = computeGen1Checksum(data, 0x2598, 0x3523);
  
  if (storedChecksum !== calculatedChecksum) {
    // Checksum mismatch, but let's do more checks
  }

  // Check for valid player name (should be terminated with 0x50 or contain valid Gen1 text chars)
  const playerNameRegion = data.slice(GEN1_PLAYER_NAME_LOC, GEN1_PLAYER_NAME_LOC + 11);
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

  if (!hasValidNameChar) return false;

  // Look for PC box structures at known Gen1 locations
  // Gen 1 has boxes in two banks: 0x4000 and 0x6000
  const boxLocations = [0x4000, 0x6000];
  
  for (const loc of boxLocations) {
    if (looksLikeGen1Box(data, loc)) {
      return true;
    }
  }

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
  
  // Extract from both box banks (6 boxes each)
  const boxBases = [
    0x4000, // Current box
    0x6000, // Box 1-6
    0x6000 + BOX_SIZE * 1,
    0x6000 + BOX_SIZE * 2,
    0x6000 + BOX_SIZE * 3,
    0x6000 + BOX_SIZE * 4,
    0x6000 + BOX_SIZE * 5,
  ];

  for (const base of boxBases) {
    if (base + BOX_SIZE > data.length) continue;
    
    const boxMons = parseGen1Box(data, base);
    mons.push(...boxMons);
  }

  return mons;
}

function parseGen1Box(data: Uint8Array, base: number): Gen1BoxMon[] {
  const mons: Gen1BoxMon[] = [];
  const count = data[base + BOX_COUNT_OFF];
  
  if (count > 20) return mons;

  for (let i = 0; i < count; i++) {
    const speciesIndex = data[base + BOX_SPECIES_OFF + i];
    if (speciesIndex === 0 || speciesIndex === 0xFF) continue;

    const monOff = base + BOX_MONS_OFF + i * MON_SIZE;
    const raw33 = data.slice(monOff, monOff + MON_SIZE);

    // Parse boxed mon structure
    // const species = raw33[0];  // Unused
    // const hp = readU16BE(raw33, 1);  // Unused
    const level = raw33[3];
    // const status = raw33[4];  // Unused
    // const type1 = raw33[5];  // Unused
    // const type2 = raw33[6];  // Unused
    // const catchRate = raw33[7];  // Unused
    const moves = [raw33[8], raw33[9], raw33[10], raw33[11]] as [number, number, number, number];
    const otId16 = readU16BE(raw33, 12);
    const exp = readU24BE(raw33, 14);
    // const hpEV = readU16BE(raw33, 17);  // Unused
    // const atkEV = readU16BE(raw33, 19);  // Unused
    // const defEV = readU16BE(raw33, 21);  // Unused
    // const speEV = readU16BE(raw33, 23);  // Unused
    // const spcEV = readU16BE(raw33, 25);  // Unused
    const dvs = readU16BE(raw33, 27);
    const pps = [raw33[29], raw33[30], raw33[31], raw33[32]] as [number, number, number, number];

    const natDex = gen1IndexToNatDex[speciesIndex];
    if (natDex === 0 || natDex === undefined) continue; // Skip unknown species

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