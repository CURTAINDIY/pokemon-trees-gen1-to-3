// src/lib/transporter/gbToPk3.ts
// Convert Gen 1/2 boxed Pokemon to Gen 3 PK3 format

import type { Gen1BoxMon, Gen2BoxMon, IVs } from '../types';
import { buildPk3BoxMon } from '../gen3/pk3';
import { sanitizeMoveset } from '../dex/moveLegality';
import { speciesName, NATURES } from '../dex/dex';
import { convertGen2ItemToGen3 } from './itemMapping';
import { convertGen1MovesToGen3, convertGen2MovesToGen3 } from './moveIndexMapping';
import { natDexToGen3Index } from '../gen3/gen3_index_to_natdex';

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
  pidLow = (pidHigh ^ trainerId ^ secretId ^ targetXor) & 0xFFFF;
  
  // Reconstruct PID and ensure nature is still correct
  pid = ((pidHigh << 16) | pidLow) >>> 0; // Force unsigned 32-bit
  if ((pid % 25) !== nature) {
    // Adjust to match nature
    const currentNature = pid % 25;
    pid = ((pid - currentNature + nature) >>> 0); // Force unsigned after adjustment
  }
  
  return pid;
}

// Unused utility functions - kept for reference
// function isPIDLegalForNature(pid: number, nature: number): boolean {
//   return (pid % 25) === nature;
// }

// function getAbilityFromPID(pid: number): number {
//   return pid & 1; // 0 or 1
// }

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
  let pid = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0; // Ensure unsigned
  const currentNature = pid % 25;
  pid = (pid - currentNature + nature) >>> 0; // Force unsigned after adjustment
  return pid;
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

  // Convert National Dex number to Gen 3 internal species index
  const natDexNum = mon.natDex > 0 ? mon.natDex : mon.speciesIndex;
  if (natDexNum === 0 || natDexNum > 386) {
    throw new Error(`Cannot convert Gen1 species index ${mon.speciesIndex} - invalid National Dex ID`);
  }
  
  // CRITICAL: Convert National Dex to Gen 3 internal index
  // Gen 3 uses different internal indices (especially for Hoenn Pokemon)
  const gen3SpeciesIndex = natDexToGen3Index(natDexNum);
  console.log(`Gen1→PK3: NatDex #${natDexNum} (${speciesName(natDexNum)}) → Gen3 Index ${gen3SpeciesIndex}`);

  // Check if Pokemon was shiny in Gen 2 (Gen 1 doesn't have shinies, but uses same DV calculation)
  const isShiny = isGen2Shiny(mon.dvs);
  
  // Generate legal PID based on DVs
  const nature = getNatureFromDVs(mon.dvs);
  const trainerId = mon.otId16 & 0xffff;
  
  // If shiny in Gen 2, generate shiny-compatible PID for Gen 3
  const pid = isShiny ? generateShinyPID(nature, trainerId) : generateMethod1PID(nature);
  
  const natureName = NATURES[nature] ?? 'Unknown';
  console.log(`Gen1→PK3: Nature: ${natureName}, PID: 0x${pid.toString(16).toUpperCase()}${isShiny ? ' ✨ SHINY' : ''}`);

  // Extract PP Ups from PP values (Gen 1/2 store actual PP, not PP ups)
  // For simplicity, assume no PP ups (0) - PCCS ORIGINAL doesn't preserve PP ups
  const ppUps: [number, number, number, number] = [0, 0, 0, 0];
  
  // CRITICAL: Convert Gen 1 move indices to Gen 3 move indices
  // Gen 1 stored moves in different internal order than Gen 3
  const gen3Moves = convertGen1MovesToGen3(mon.moves);
  
  // Sanitize moves according to PCCS ORIGINAL method
  const { moves: cleanedMoves, ppUps: _cleanedPPUps } = sanitizeMoveset(
    natDexNum,
    gen3Moves,
    ppUps
  );

  return buildPk3BoxMon({
    pid,
    trainerId,
    secretId: 0,  // Gen 1/2 don't have Secret ID, use 0
    speciesId: gen3SpeciesIndex,
    heldItemId: 0,
    exp: mon.exp,
    friendship: 70,
    nickname: speciesName(natDexNum),  // Use species name as nickname (NatDex based)
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

  const natDexNum = mon.natDex;  // Use National Dex, not Gen 2 internal ID
  if (natDexNum === 0 || natDexNum > 386) {
    throw new Error(`Invalid Gen2 National Dex: ${natDexNum} (Gen2 ID: ${mon.speciesId})`);
  }

  // CRITICAL: Convert National Dex to Gen 3 internal index
  const gen3SpeciesIndex = natDexToGen3Index(natDexNum);
  console.log(`Gen2→PK3: NatDex #${natDexNum} (${speciesName(natDexNum)}) → Gen3 Index ${gen3SpeciesIndex}`);

  // Check if Pokemon is shiny in Gen 2
  const isShiny = isGen2Shiny(mon.dvs);
  
  // Generate legal PID based on DVs
  const nature = getNatureFromDVs(mon.dvs);
  const trainerId = mon.otId16 & 0xffff;
  
  // If shiny in Gen 2, generate shiny-compatible PID for Gen 3
  const pid = isShiny ? generateShinyPID(nature, trainerId) : generateMethod1PID(nature);
  
  const natureName = NATURES[nature] ?? 'Unknown';
  console.log(`Gen2→PK3: Nature: ${natureName}, PID: 0x${pid.toString(16).toUpperCase()}${isShiny ? ' ✨ SHINY' : ''}`);

  // Extract PP Ups from PP values (Gen 2 stores actual PP, not PP ups)
  // For simplicity, assume no PP ups (0) - PCCS ORIGINAL doesn't preserve PP ups
  const ppUps: [number, number, number, number] = [0, 0, 0, 0];
  
  // CRITICAL: Convert Gen 2 move indices to Gen 3 move indices
  // Gen 2 stored moves in different internal order than Gen 3
  const gen3Moves = convertGen2MovesToGen3(mon.moves);
  
  console.log(`Gen2→PK3 Moves: Raw Gen2=[${mon.moves.join(', ')}] → Gen3=[${gen3Moves.join(', ')}] for species ${natDexNum}`);
  
  // Sanitize moves according to PCCS ORIGINAL method
  const { moves: cleanedMoves, ppUps: _cleanedPPUps } = sanitizeMoveset(
    natDexNum,
    gen3Moves,
    ppUps
  );

  // Convert Gen 2 held item index to Gen 3
  const gen3ItemId = convertGen2ItemToGen3(mon.heldItem);

  return buildPk3BoxMon({
    pid,
    trainerId,
    secretId: 0,  // Gen 1/2 don't have Secret ID, use 0
    speciesId: gen3SpeciesIndex,
    heldItemId: gen3ItemId,
    exp: mon.exp,
    friendship: 70,
    nickname: speciesName(natDexNum),  // Use species name as nickname
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