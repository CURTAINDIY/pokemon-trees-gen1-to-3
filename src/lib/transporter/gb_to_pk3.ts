// src/lib/transporter/gbToPk3.ts
// Convert Gen 1/2 boxed Pokemon to Gen 3 PK3 format

import type { Gen1BoxMon, Gen2BoxMon, IVs } from '../types';
import { buildPk3BoxMon } from '../gen3/pk3';
import { sanitizeMoveset } from '../dex/moveLegality';
import { speciesName } from '../dex/dex';
import { convertGen2ItemToGen3 } from './itemMapping';

const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
];

function lcrgNext(seed: number): number {
  return ((seed * 0x41C64E6D) + 0x6073) >>> 0;
}

// Determine nature from DVs (Gen1/2 behavior)
function getNatureFromDVs(dvs: number): number {
  // In Gen1/2, we can derive a "personality" from DVs
  // Use DV combination to pick a nature that feels consistent
  const atkDV = (dvs >> 12) & 0x0f;
  const defDV = (dvs >> 8) & 0x0f;
  const speDV = (dvs >> 4) & 0x0f;
  const spaDV = (dvs >> 0) & 0x0f;
  
  // Create pseudo-personality from DVs
  const personality = (atkDV * 5 + defDV * 3 + speDV * 7 + spaDV * 11) % 25;
  return personality;
}

// Gen 2 shiny determination (DVs-based, not PID-based)
// A Pokemon is shiny in Gen 2 if:
// - Defense DV = 10
// - Speed DV = 10  
// - Special DV = 10
// - Attack DV = 2, 3, 6, 7, 10, 11, 14, or 15
function isGen2Shiny(dvs: number): boolean {
  const atkDV = (dvs >> 12) & 0x0f;
  const defDV = (dvs >> 8) & 0x0f;
  const speDV = (dvs >> 4) & 0x0f;
  const spaDV = (dvs >> 0) & 0x0f;
  
  // Check the required DV values for shiny
  if (defDV !== 10) return false;
  if (speDV !== 10) return false;
  if (spaDV !== 10) return false;
  
  // Attack DV must be one of these values for shiny
  const validAtkDVs = [2, 3, 6, 7, 10, 11, 14, 15];
  return validAtkDVs.includes(atkDV);
}

// Gen 3 shiny determination (PID XOR TID-based)
// A Pokemon is shiny in Gen 3 if: (PID_high XOR PID_low XOR TID XOR SID) < 8
function isGen3Shiny(pid: number, trainerId: number, secretId: number): boolean {
  const pidHigh = (pid >>> 16) & 0xFFFF;
  const pidLow = pid & 0xFFFF;
  const xor = pidHigh ^ pidLow ^ trainerId ^ secretId;
  return xor < 8;
}

// Generate shiny-compatible PID for Gen 1/2 Pokemon
// This ensures transferred shiny Pokemon stay shiny in Gen 3
function generateShinyPID(nature: number, trainerId: number): number {
  const secretId = 0; // Gen 1/2 don't have secret ID
  const maxAttempts = 100000;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let seed = Math.floor(Math.random() * 0xFFFFFFFF);
    
    // Method 1: Generate PID from two consecutive LCRNG calls
    seed = lcrgNext(seed);
    const pidLow = (seed >>> 16) & 0xFFFF;
    seed = lcrgNext(seed);
    const pidHigh = (seed >>> 16) & 0xFFFF;
    const pid = (pidHigh << 16) | pidLow;
    
    // Check if nature matches
    if ((pid % 25) !== nature) continue;
    
    // Check if it produces a shiny with the given IDs
    if (isGen3Shiny(pid, trainerId, secretId)) {
      return pid;
    }
  }
  
  // Fallback: force shiny by manipulating bits
  let pid = generateMethod1PID(nature);
  const pidHigh = (pid >>> 16) & 0xFFFF;
  let pidLow = pid & 0xFFFF;
  
  // Force XOR to be < 8 to make shiny
  const targetXor = Math.floor(Math.random() * 8); // 0-7 for shiny
  pidLow = pidHigh ^ trainerId ^ secretId ^ targetXor;
  
  // Reconstruct PID and ensure nature is still correct
  pid = (pidHigh << 16) | pidLow;
  if ((pid % 25) !== nature) {
    // Adjust to match nature
    const currentNature = pid % 25;
    const diff = nature - currentNature;
    pid = (pid - currentNature + nature);
    if (pid < 0) pid += 0x100000000;
  }
  
  return pid >>> 0;
}

// Check if PID is legal for given nature
function isPIDLegalForNature(pid: number, nature: number): boolean {
  return (pid % 25) === nature;
}

// Check if ability matches PID
function getAbilityFromPID(pid: number): number {
  return pid & 1; // 0 or 1
}

// Generate legal PID using Method 1 (standard wild encounter method)
// This ensures PID % 25 matches nature and is properly generated from LCRNG
function generateMethod1PID(nature: number, desiredAbility: number = 0): number {
  const maxAttempts = 100000;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Start with random seed
    let seed = Math.floor(Math.random() * 0xFFFFFFFF);
    
    // Method 1: Generate PID from two consecutive LCRNG calls
    seed = lcrgNext(seed);
    const pidLow = (seed >>> 16) & 0xFFFF;
    seed = lcrgNext(seed);
    const pidHigh = (seed >>> 16) & 0xFFFF;
    const pid = (pidHigh << 16) | pidLow;
    
    // Check if nature matches
    if ((pid % 25) !== nature) continue;
    
    // Check if ability matches (if we care about it)
    if (desiredAbility !== undefined && (pid & 1) !== desiredAbility) continue;
    
    return pid;
  }
  
  // Fallback: generate random PID and force nature
  // This is less "legal" but ensures we always succeed
  let pid = Math.floor(Math.random() * 0xFFFFFFFF);
  const currentNature = pid % 25;
  const natureDiff = nature - currentNature;
  pid = (pid - currentNature + nature);
  if (pid < 0) pid += 0x100000000;
  return pid >>> 0;
}

// Legality validation functions
interface LegalityIssue {
  type: 'error' | 'warning';
  message: string;
}

function validatePk3Legality(pk3Data: {
  pid: number;
  ivs: IVs;
  speciesId: number;
  moves: number[];
}): LegalityIssue[] {
  const issues: LegalityIssue[] = [];
  
  // Check PID/Nature correlation
  const nature = pk3Data.pid % 25;
  if (nature < 0 || nature >= 25) {
    issues.push({
      type: 'error',
      message: `Invalid nature from PID: ${nature}`
    });
  }
  
  // Check IVs are in valid range
  const ivArray = [pk3Data.ivs.hp, pk3Data.ivs.atk, pk3Data.ivs.def, 
                   pk3Data.ivs.spa, pk3Data.ivs.spd, pk3Data.ivs.spe];
  for (let i = 0; i < ivArray.length; i++) {
    if (ivArray[i] < 0 || ivArray[i] > 31) {
      issues.push({
        type: 'error',
        message: `Invalid IV at index ${i}: ${ivArray[i]} (must be 0-31)`
      });
    }
  }
  
  // Check species ID
  if (pk3Data.speciesId < 1 || pk3Data.speciesId > 386) {
    issues.push({
      type: 'error',
      message: `Invalid species ID: ${pk3Data.speciesId}`
    });
  }
  
  // Check moves (basic validation)
  for (let i = 0; i < pk3Data.moves.length; i++) {
    if (pk3Data.moves[i] < 0 || pk3Data.moves[i] > 354) {
      issues.push({
        type: 'warning',
        message: `Move ${i} has invalid ID: ${pk3Data.moves[i]}`
      });
    }
  }
  
  return issues;
}

// Auto-fix common legality issues
function autoFixLegality(pk3Data: {
  pid: number;
  ivs: IVs;
  speciesId: number;
  moves: number[];
}): void {
  // Clamp IVs to valid range
  pk3Data.ivs.hp = Math.max(0, Math.min(31, pk3Data.ivs.hp));
  pk3Data.ivs.atk = Math.max(0, Math.min(31, pk3Data.ivs.atk));
  pk3Data.ivs.def = Math.max(0, Math.min(31, pk3Data.ivs.def));
  pk3Data.ivs.spa = Math.max(0, Math.min(31, pk3Data.ivs.spa));
  pk3Data.ivs.spd = Math.max(0, Math.min(31, pk3Data.ivs.spd));
  pk3Data.ivs.spe = Math.max(0, Math.min(31, pk3Data.ivs.spe));
  
  // Ensure PID is valid
  if (pk3Data.pid < 0 || pk3Data.pid > 0xFFFFFFFF) {
    pk3Data.pid = Math.floor(Math.random() * 0xFFFFFFFF);
  }
  
  // Remove invalid moves (set to 0)
  for (let i = 0; i < pk3Data.moves.length; i++) {
    if (pk3Data.moves[i] < 0 || pk3Data.moves[i] > 354) {
      pk3Data.moves[i] = 0;
    }
  }
}

export function convertGen1BoxMonToPk3(mon: Gen1BoxMon): Uint8Array {
  // Extract DVs from Gen 1 format
  const dvs = mon.dvs;
  const atkDV = (dvs >> 12) & 0x0f;
  const defDV = (dvs >> 8) & 0x0f;
  const speDV = (dvs >> 4) & 0x0f;
  const spaDV = (dvs >> 0) & 0x0f;
  
  // Gen 1 HP DV is calculated from other DVs
  const hpDV = ((atkDV & 1) << 3) | ((defDV & 1) << 2) | ((speDV & 1) << 1) | (spaDV & 1);
  
  // Convert DVs to IVs (multiply by 2 to map 0-15 range to 0-30 in Gen 3's 0-31 range)
  const ivs: IVs = {
    hp: hpDV * 2,
    atk: atkDV * 2,
    def: defDV * 2,
    spe: speDV * 2,
    spa: spaDV * 2,
    spd: spaDV * 2, // Gen 1/2 only have Special, use for both SpA and SpD
  };

  const speciesId = mon.natDex > 0 ? mon.natDex : mon.speciesIndex;
  if (speciesId === 0 || speciesId > 386) {
    throw new Error(`Cannot convert Gen1 species index ${mon.speciesIndex} - invalid National Dex ID`);
  }

  // Check if Pokemon was shiny in Gen 2 (Gen 1 doesn't have shinies, but uses same DV calculation)
  const isShiny = isGen2Shiny(mon.dvs);
  
  // Generate legal PID based on DVs
  const nature = getNatureFromDVs(mon.dvs);
  const trainerId = mon.otId16 & 0xffff;
  
  // If shiny in Gen 2, generate shiny-compatible PID for Gen 3
  const pid = isShiny ? generateShinyPID(nature, trainerId) : generateMethod1PID(nature);
  
  const natureName = NATURES[nature] ?? 'Unknown';
  console.log(`Gen1→PK3: Species ${speciesId}, Nature: ${natureName}, PID: 0x${pid.toString(16).toUpperCase()}${isShiny ? ' ✨ SHINY' : ''}`);

  // Extract PP Ups from PP values (Gen 1/2 store actual PP, not PP ups)
  // For simplicity, assume no PP ups (0) - PCCS ORIGINAL doesn't preserve PP ups
  const ppUps: [number, number, number, number] = [0, 0, 0, 0];
  
  // Sanitize moves according to PCCS ORIGINAL method
  const { moves: cleanedMoves, ppUps: cleanedPPUps } = sanitizeMoveset(
    speciesId,
    mon.moves,
    ppUps
  );

  return buildPk3BoxMon({
    pid,
    trainerId,
    secretId: 0,  // Gen 1/2 don't have Secret ID, use 0
    speciesId,
    heldItemId: 0,
    exp: mon.exp,
    friendship: 70,
    nickname: speciesName(speciesId),  // Use species name as nickname
    otName: "",
    moves: cleanedMoves,
    movePPs: mon.pps,
    ivs,
    evs: { hp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0 },
    metLocation: 0xFF, // Fateful encounter
    metLevel: mon.level,
    ballCaughtWith: 4, // Poke Ball
    otGender: 0,
    abilityBit: 0,
    language: 0x0201, // English
  });
}

export function convertGen2BoxMonToPk3(mon: Gen2BoxMon): Uint8Array {
  // Extract DVs from Gen 2 format
  const dvs = mon.dvs;
  const atkDV = (dvs >> 12) & 0x0f;
  const defDV = (dvs >> 8) & 0x0f;
  const speDV = (dvs >> 4) & 0x0f;
  const spaDV = (dvs >> 0) & 0x0f;
  
  // Gen 2 HP DV is calculated from other DVs
  const hpDV = ((atkDV & 1) << 3) | ((defDV & 1) << 2) | ((speDV & 1) << 1) | (spaDV & 1);
  
  // Convert DVs to IVs
  const ivs: IVs = {
    hp: hpDV * 2,
    atk: atkDV * 2,
    def: defDV * 2,
    spe: speDV * 2,
    spa: spaDV * 2,
    spd: spaDV * 2, // Gen 2 only has Special, use for both SpA and SpD
  };

  const speciesId = mon.natDex;  // Use National Dex, not Gen 2 internal ID
  if (speciesId === 0 || speciesId > 386) {
    throw new Error(`Invalid Gen2 National Dex: ${speciesId} (Gen2 ID: ${mon.speciesId})`);
  }

  // Check if Pokemon is shiny in Gen 2
  const isShiny = isGen2Shiny(mon.dvs);
  
  // Generate legal PID based on DVs
  const nature = getNatureFromDVs(mon.dvs);
  const trainerId = mon.otId16 & 0xffff;
  
  // If shiny in Gen 2, generate shiny-compatible PID for Gen 3
  const pid = isShiny ? generateShinyPID(nature, trainerId) : generateMethod1PID(nature);
  
  const natureName = NATURES[nature] ?? 'Unknown';
  console.log(`Gen2→PK3: Species ${speciesId}, Nature: ${natureName}, PID: 0x${pid.toString(16).toUpperCase()}${isShiny ? ' ✨ SHINY' : ''}`);

  // Extract PP Ups from PP values (Gen 2 stores actual PP, not PP ups)
  // For simplicity, assume no PP ups (0) - PCCS ORIGINAL doesn't preserve PP ups
  const ppUps: [number, number, number, number] = [0, 0, 0, 0];
  
  // Sanitize moves according to PCCS ORIGINAL method
  const { moves: cleanedMoves, ppUps: cleanedPPUps } = sanitizeMoveset(
    speciesId,
    mon.moves,
    ppUps
  );

  // Convert Gen 2 held item index to Gen 3
  const gen3ItemId = convertGen2ItemToGen3(mon.heldItem);

  return buildPk3BoxMon({
    pid,
    trainerId,
    secretId: 0,  // Gen 1/2 don't have Secret ID, use 0
    speciesId,
    heldItemId: gen3ItemId,
    exp: mon.exp,
    friendship: 70,
    nickname: speciesName(speciesId),  // Use species name as nickname
    otName: "",
    moves: cleanedMoves,
    movePPs: mon.pps,
    ivs,
    evs: { hp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0 },
    metLocation: 0xFF,
    metLevel: mon.level,
    ballCaughtWith: 4,
    otGender: 0,
    abilityBit: 0,
    language: 0x0201,
  });
}