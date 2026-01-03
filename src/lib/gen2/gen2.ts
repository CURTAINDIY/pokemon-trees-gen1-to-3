// src/lib/gen2/gen2.ts
// Gen 2 (G/S/C) save parsing with robust detection
// Saves are 32KB (0x8000 bytes)

import type { Gen2BoxMon } from '../types';
import { gen2IndexToNatDex } from './gen2_index_to_natdex';
import { speciesName } from '../dex/dex';

export const GEN2_SAVE_SIZE = 0x8000; // 32KB

// Gen 2 signature locations
export const GEN2_CHECKSUM_LOC = 0x2D69; // Main checksum location
export const GEN2_PLAYER_NAME_LOC = 0x200B;
const GEN2_BOX_COUNT = 14;
const GEN2_BOX_SIZE = 0x450; // Gen 2 box structure size

function readU16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

function readU24BE(b: Uint8Array, o: number): number {
  return (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
}

function normalizeGen2Save(raw: Uint8Array): Uint8Array {
  if (raw.length === 0x8000) return raw;
  if (raw.length === 0x10000) {
    return raw.slice(0x8000);
  }
  // For files with extra bytes (headers/footers), try trimming from the end first
  if (raw.length > 0x8000 && raw.length <= 0x8200) {
    // First try: assume header at start, take first 32KB
    const attempt1 = raw.slice(0, 0x8000);
    // Second try: assume footer at end, take last 32KB  
    const attempt2 = raw.slice(raw.length - 0x8000);
    
    // Return whichever looks more like a valid save
    // Check if either has valid player name region
    const checkPlayerName = (data: Uint8Array): boolean => {
      const playerNameRegion = data.slice(GEN2_PLAYER_NAME_LOC, GEN2_PLAYER_NAME_LOC + 11);
      for (let i = 0; i < playerNameRegion.length; i++) {
        const c = playerNameRegion[i];
        if (c === 0x50) break; // terminator
        if ((c >= 0x80 && c <= 0xF6) || c === 0x50) return true;
      }
      return false;
    };
    
    if (checkPlayerName(attempt1)) return attempt1;
    if (checkPlayerName(attempt2)) return attempt2;
    
    // Default to first 32KB if both fail
    return attempt1;
  }
  if (raw.length > 0x8000) {
    return raw.slice(raw.length - 0x8000);
  }
  return raw;
}

function computeGen2Checksum(data: Uint8Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum = (sum + data[i]) & 0xFFFF;
  }
  return sum;
}

export function detectGen2Save(raw: Uint8Array): boolean {
  const data = normalizeGen2Save(raw);
  if (data.length !== 0x8000) {
    console.log(`[Gen2 Detection] Invalid size after normalization: ${data.length}`);
    return false;
  }

  // Check for Gen 2 specific signature
  // Gen 2 stores boxes at 0x4000 (current box) and 0x6000 (box 1+)
  
  // Check player name region for valid Gen2 text
  const playerNameRegion = data.slice(GEN2_PLAYER_NAME_LOC, GEN2_PLAYER_NAME_LOC + 11);
  console.log(`[Gen2 Detection] Player name region bytes:`, Array.from(playerNameRegion).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
  
  let hasValidNameChar = false;
  for (let i = 0; i < playerNameRegion.length; i++) {
    const c = playerNameRegion[i];
    if (c === 0x50) break; // terminator
    if ((c >= 0x80 && c <= 0xF6) || c === 0x50) {
      hasValidNameChar = true;
      break;
    }
  }

  console.log(`[Gen2 Detection] Valid name char found: ${hasValidNameChar}`);
  
  if (!hasValidNameChar) return false;

  // Look for Gen 2 box structures
  // Gen 2 has a different box layout than Gen 1
  const boxLocations = [0x4000, 0x6000];
  
  for (const loc of boxLocations) {
    const boxValid = looksLikeGen2Box(data, loc);
    console.log(`[Gen2 Detection] Box at 0x${loc.toString(16)}: ${boxValid ? 'VALID' : 'invalid'}`);
    if (boxValid) {
      return true;
    }
  }

  console.log(`[Gen2 Detection] No valid boxes found`);
  return false;
}

export function looksLikeGen2Box(data: Uint8Array, offset: number): boolean {
  if (offset + 0x450 > data.length) return false;

  const count = data[offset];
  if (count > 20) return false; // Gen 2 Crystal can have up to 20 mons per box

  // Check species terminator - should be immediately after the species list
  // Position: offset + 1 (species list start) + count (number of species)
  const termOffset = offset + 1 + count;
  if (termOffset >= data.length || data[termOffset] !== 0xFF) return false;

  // Validate species IDs (Gen 2 uses 1-251 internal indices)
  for (let i = 0; i < count; i++) {
    const speciesId = data[offset + 1 + i];
    if (speciesId === 0 || speciesId > 251) return false;
  }

  // Check that mon structures match species list
  const monsBase = offset + 0x16;
  for (let i = 0; i < count; i++) {
    const monOff = monsBase + i * 32;
    if (monOff + 32 > data.length) return false;
    
    const monSpecies = data[monOff];
    const listSpecies = data[offset + 1 + i];
    
    if (monSpecies !== listSpecies) return false;
    
    // Check level is reasonable
    const level = data[monOff + 0x1F];
    if (level === 0 || level > 100) return false;
  }

  return true;
}

export function extractGen2BoxMons(raw: Uint8Array): Gen2BoxMon[] {
  const data = normalizeGen2Save(raw);
  if (data.length !== 0x8000) {
    throw new Error('Invalid Gen 2 save size');
  }

  const mons: Gen2BoxMon[] = [];
  
  // Gen 2 has 14 boxes total:
  // - Current box at 0x4000
  // - Boxes 1-13 starting at 0x6000, each 0x450 bytes apart
  const boxBases: number[] = [0x4000]; // Current box
  
  // Add boxes 1-13
  for (let i = 0; i < 13; i++) {
    boxBases.push(0x6000 + 0x450 * i);
  }

  console.log(`\n=== Gen 2 Box Extraction ===`);
  console.log(`Scanning ${boxBases.length} boxes...`);

  let totalExtracted = 0;
  for (let boxNum = 0; boxNum < boxBases.length; boxNum++) {
    const base = boxBases[boxNum];
    if (base + 0x450 > data.length) {
      console.warn(`Box ${boxNum} at offset 0x${base.toString(16)} exceeds save size, skipping`);
      continue;
    }
    
    try {
      const boxMons = parseGen2Box(data, base, boxNum);
      if (boxMons.length > 0) {
        console.log(`Box ${boxNum}: extracted ${boxMons.length} Pokemon`);
        totalExtracted += boxMons.length;
      }
      mons.push(...boxMons);
    } catch (err) {
      console.warn(`Failed to parse box ${boxNum}:`, err);
    }
  }

  console.log(`Total Gen 2 Pokemon extracted: ${totalExtracted}`);
  console.log(`============================\n`);

  return mons;
}

function parseGen2Box(data: Uint8Array, base: number, boxNum: number): Gen2BoxMon[] {
  const mons: Gen2BoxMon[] = [];
  const count = data[base];
  
  // Gen 2 boxes can hold up to 20 Pokemon
  if (count > 20) {
    console.warn(`Box ${boxNum}: Invalid count ${count}, skipping`);
    return mons;
  }

  const monsBase = base + 0x16;

  for (let i = 0; i < count; i++) {
    const monOff = monsBase + i * 32;
    if (monOff + 32 > data.length) {
      console.warn(`Box ${boxNum} slot ${i}: offset exceeds save size, skipping`);
      continue;
    }
    
    const raw32 = data.slice(monOff, monOff + 32);

    // Parse Gen 2 boxed mon structure
    const speciesId = raw32[0];
    const heldItem = raw32[1];
    const moves = [raw32[2], raw32[3], raw32[4], raw32[5]] as [number, number, number, number];
    const otId16 = readU16BE(raw32, 6);
    const exp = readU24BE(raw32, 8);
    const hpEV = readU16BE(raw32, 11);
    const atkEV = readU16BE(raw32, 13);
    const defEV = readU16BE(raw32, 15);
    const speEV = readU16BE(raw32, 17);
    const spcEV = readU16BE(raw32, 19);
    const dvs = readU16BE(raw32, 21);
    const pps = [raw32[23], raw32[24], raw32[25], raw32[26]] as [number, number, number, number];
    const friendship = raw32[27];
    const pokerus = raw32[28];
    const caughtData = readU16BE(raw32, 29);
    const level = raw32[31];

    if (speciesId === 0 || speciesId > 251) {
      // Empty slot or invalid species
      continue;
    }

    const natDex = gen2IndexToNatDex(speciesId);
    if (natDex === 0) {
      console.warn(`Box ${boxNum} slot ${i}: Invalid species mapping for index ${speciesId}`);
      continue; // Invalid mapping
    }

    mons.push({
      raw32,
      speciesId,
      natDex,
      otId16,
      exp,
      level,
      heldItem,
      moves,
      pps,
      dvs,
    });
  }

  return mons;
}