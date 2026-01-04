// src/lib/gen3/pk3.ts
// Gen 3 boxed PKM (.pk3) = 80 bytes
// Offsets based on the standard Gen 3 BoxPokemon structure:
// PID @ 0x00, OTID @ 0x04, Nick @ 0x08, OT Name @ 0x14, Checksum @ 0x1C, Encrypted substructs @ 0x20..0x4F

import type { IVs, EVs } from '../types';
import { gen3IndexToNatDex, natDexToGen3Index } from './gen3_index_to_natdex';
import { natureFromPid } from '../dex/dex';

// Type extension for debug flag
declare global {
  interface Window {
    __mudkipRawLogged?: boolean;
  }
}

export type Pk3Decoded = {
  pid: number;
  otId: number;
  trainerId: number;  // 16-bit trainer ID
  secretId: number;   // 16-bit secret ID

  nickname: string;
  otName: string;

  speciesId: number;
  checksumStored: number;
  checksumCalculated: number;
  checksumOk: boolean;
  isShiny?: boolean;  // Whether Pokemon is shiny

  // All metadata fields (ONLY trust when checksumOk=true)
  level?: number;
  metLevel?: number;
  heldItem?: number;
  moves?: number[];
  movePPs?: number[];
  ivs?: IVs;
  evs?: EVs;
  nature?: number;      // 0-24 nature index
  natureName?: string;  // Human-readable nature name
  pokerus?: number;     // Pokerus status byte
  hasPokerus?: boolean; // Whether Pokemon currently has Pokerus
  hadPokerus?: boolean; // Whether Pokemon was cured of Pokerus
  friendship?: number;
  experience?: number;
  ability?: number;
  abilityName?: string;
  metLocation?: number;
  ballCaughtWith?: number;
  otGender?: number;
};

// const GEN3_MAX_SPECIES = 386;  // Unused currently

// Bulbapedia-style block order table:
// indices: 0=Growth, 1=Attacks, 2=EV/Condition, 3=Misc
// order[physicalPos] = logicalBlockId stored at that physical position
const SUBSTRUCT_ORDERS: number[][] = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
  [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0],
  [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0],
];

function readU16LE(b: Uint8Array, off: number): number {
  return (b[off] | (b[off + 1] << 8)) >>> 0;
}
function readU32LE(b: Uint8Array, off: number): number {
  return (
    (b[off] |
      (b[off + 1] << 8) |
      (b[off + 2] << 16) |
      (b[off + 3] << 24)) >>> 0
  );
}
function writeU16LE(b: Uint8Array, off: number, v: number) {
  b[off] = v & 0xff;
  b[off + 1] = (v >>> 8) & 0xff;
}
function writeU32LE(b: Uint8Array, off: number, v: number) {
  b[off] = v & 0xff;
  b[off + 1] = (v >>> 8) & 0xff;
  b[off + 2] = (v >>> 16) & 0xff;
  b[off + 3] = (v >>> 24) & 0xff;
}

function checksum16OfPlain48(plain48: Uint8Array): number {
  // Sum of 24 little-endian u16 words, truncated to 16-bit
  let sum = 0;
  for (let i = 0; i < 48; i += 2) sum = (sum + readU16LE(plain48, i)) & 0xffff;
  return sum >>> 0;
}

function decodeGen3String(bytes: Uint8Array): string {
  // Gen 3 character encoding
  const out: string[] = [];
  for (const c of bytes) {
    if (c === 0x00 || c === 0xff) break;
    
    // Uppercase A-Z: 0xBB-0xD4
    if (c >= 0xbb && c <= 0xd4) {
      out.push(String.fromCharCode(65 + (c - 0xbb)));
    }
    // Lowercase a-z: 0xD5-0xEE
    else if (c >= 0xd5 && c <= 0xee) {
      out.push(String.fromCharCode(97 + (c - 0xd5)));
    }
    // Digits 0-9: 0xA1-0xAA
    else if (c >= 0xa1 && c <= 0xaa) {
      out.push(String.fromCharCode(48 + (c - 0xa1)));
    }
    else if (c === 0x00) {
      out.push(" ");
    }
    else {
      out.push("?");
    }
  }
  return out.join("").trim();
}

function decrypt48(enc48: Uint8Array, key: number): Uint8Array {
  const dec = new Uint8Array(48);
  for (let i = 0; i < 48; i += 4) {
    const w = readU32LE(enc48, i) ^ key;
    writeU32LE(dec, i, w >>> 0);
  }
  return dec;
}

function unshuffle48(
  dec48: Uint8Array,
  pid: number
): Uint8Array {
  // SUBSTRUCT_ORDERS table: order[physicalPos] = logicalBlock
  // This means: "at physical position X in the SHUFFLED data, you'll find logical block Y"
  // 
  // To UNSHUFFLE (go from shuffled → unshuffled):
  // We need to find where each logical block is physically located and move it to its logical position
  // 
  // For logical block N, find which physical position contains it: order.indexOf(N)
  // Then copy from that physical position to logical position N
  const order = SUBSTRUCT_ORDERS[pid % 24];
  const plain = new Uint8Array(48);

  for (let logicalBlock = 0; logicalBlock < 4; logicalBlock++) {
    // Find which physical position contains this logical block
    const physicalPos = order.indexOf(logicalBlock);
    plain.set(
      dec48.subarray(physicalPos * 12, physicalPos * 12 + 12),
      logicalBlock * 12
    );
  }

  return plain;
}

// Unused utility function - kept for reference
// function speciesLooksValid(speciesId: number): boolean {
//   return Number.isInteger(speciesId) && speciesId >= 1 && speciesId <= GEN3_MAX_SPECIES;
// }

export function isProbablyEmptyPk3(raw80: Uint8Array): boolean {
  if (raw80.length !== 80) return false;
  const pid = readU32LE(raw80, 0x00);
  const checksumStored = readU16LE(raw80, 0x1c);
  return pid === 0 && checksumStored === 0;
}

export function decodePk3ForDisplay(raw80: Uint8Array): Pk3Decoded {
  if (raw80.length !== 80) throw new Error(`pk3 must be 80 bytes, got ${raw80.length}`);

  const pid = readU32LE(raw80, 0x00);
  const otId = readU32LE(raw80, 0x04);
  const checksumStored = readU16LE(raw80, 0x1c);

  const nickname = decodeGen3String(raw80.subarray(0x08, 0x08 + 10));
  const otName = decodeGen3String(raw80.subarray(0x14, 0x14 + 7));

  const key = (pid ^ otId) >>> 0;
  const enc48 = raw80.subarray(0x20, 0x20 + 48);
  const dec48 = decrypt48(enc48, key);

  // Unshuffle using the standard Gen 3 algorithm
  const plain = unshuffle48(dec48, pid);

  const checksumCalculated = checksum16OfPlain48(plain);
  const checksumOk = checksumCalculated === checksumStored;

  // Species is at offset 0x00 in Growth block (logical block 0)
  // This is the Gen 3 internal index, not National Dex number
  const speciesIndex = readU16LE(plain, 0);
  const speciesId = gen3IndexToNatDex(speciesIndex);
  
  // Debug: dump raw bytes of ONE MUDKIP→Surskit case for analysis
  if (typeof window !== 'undefined' && speciesId === 283 && pid !== 0 && !window.__mudkipRawLogged) {
    window.__mudkipRawLogged = true;
    console.log('[PK3 Debug] Raw 80-byte dump of MUDKIP→Surskit case:');
    console.log('Raw80 hex:', Array.from(raw80).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('Details:', {
      pid: `0x${pid.toString(16).padStart(8, '0')}`,
      otId: `0x${otId.toString(16).padStart(8, '0')}`,
      pidMod24: ((pid % 24) + 24) % 24,
      order: SUBSTRUCT_ORDERS[((pid % 24) + 24) % 24],
      key: `0x${key.toString(16).padStart(8, '0')}`,
      checksumStored: `0x${checksumStored.toString(16).padStart(4, '0')}`,
      checksumCalculated: `0x${checksumCalculated.toString(16).padStart(4, '0')}`,
      checksumOk,
      decodedSpecies: speciesId,
      nickname: `"${nickname}"`,
      encryptedBlock: Array.from(enc48).map(b => b.toString(16).padStart(2, '0')).join(' '),
      decryptedBlock: Array.from(dec48).map(b => b.toString(16).padStart(2, '0')).join(' '),
      unshuffledBlock: Array.from(plain).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
  }

  // Extract all metadata from the 4 logical blocks
  // Block 0: Growth (species, item, exp, friendship)
  const growth = plain.subarray(0, 12);
  const heldItem = readU16LE(growth, 0x02);
  const experience = readU32LE(growth, 0x04);
  const friendship = growth[0x09];

  // Block 1: Attacks (moves and PPs)
  const attacks = plain.subarray(12, 24);
  const moves = [
    readU16LE(attacks, 0x00),
    readU16LE(attacks, 0x02),
    readU16LE(attacks, 0x04),
    readU16LE(attacks, 0x06),
  ];
  const movePPs = [
    attacks[0x08],
    attacks[0x09],
    attacks[0x0A],
    attacks[0x0B],
  ];

  // Block 2: EVs and Condition
  const evCondition = plain.subarray(24, 36);
  const evs: EVs = {
    hp: evCondition[0],
    atk: evCondition[1],
    def: evCondition[2],
    spe: evCondition[3],
    spa: evCondition[4],
    spd: evCondition[5],
  };

  // Block 3: Misc (pokerus, met location, IVs, ability, ball, etc.)
  const misc = plain.subarray(36, 48);
  const pokerus = misc[0x00];
  const metLocation = misc[0x01];
  const origin = readU16LE(misc, 0x02);
  const metLevel = origin & 0x7f;
  const ballAndGender = misc[0x03];
  const ballCaughtWith = ballAndGender & 0x0f;
  const otGender = (ballAndGender >>> 7) & 0x01;

  const ivWord = readU32LE(misc, 0x04);
  const ivs: IVs = {
    hp: ivWord & 0x1f,
    atk: (ivWord >>> 5) & 0x1f,
    def: (ivWord >>> 10) & 0x1f,
    spe: (ivWord >>> 15) & 0x1f,
    spa: (ivWord >>> 20) & 0x1f,
    spd: (ivWord >>> 25) & 0x1f,
  };
  const abilityBit = (ivWord >>> 31) & 0x01;

  // Calculate nature from PID using centralized helper
  const { id: nature, name: natureName } = natureFromPid(pid);

  // Pokerus status
  const hasPokerus = (pokerus & 0x0F) !== 0;
  const hadPokerus = (pokerus & 0xF0) !== 0;

  // Extract trainer IDs
  const trainerId = otId & 0xFFFF;
  const secretId = (otId >>> 16) & 0xFFFF;

  // Calculate level from experience (simplified - use exp groups for accuracy)
  // For now, estimate from metLevel or exp
  const level = metLevel; // Boxed Pokemon don't have current level, use met level as estimate

  // Check if Pokemon is shiny (Gen 3 method: XOR < 8)
  const pidHigh = (pid >>> 16) & 0xFFFF;
  const pidLow = pid & 0xFFFF;
  const xor = pidHigh ^ pidLow ^ trainerId ^ secretId;
  const isShiny = xor < 8;

  return {
    pid,
    otId,
    trainerId,
    secretId,
    nickname,
    otName,
    speciesId,
    checksumStored,
    checksumCalculated,
    checksumOk,
    isShiny,
    level,
    metLevel,
    heldItem,
    moves,
    movePPs,
    ivs,
    evs,
    nature,
    natureName,
    pokerus,
    hasPokerus,
    hadPokerus,
    friendship,
    experience,
    ability: abilityBit,
    metLocation,
    ballCaughtWith,
    otGender,
  };
}

export function decodePk3(raw80: Uint8Array): Pk3Decoded {
  return decodePk3ForDisplay(raw80);
}

// Encoder stub for buildPk3BoxMon (used by GB→PK3 conversion)
export function buildPk3BoxMon(params: {
  pid: number;
  trainerId: number;
  secretId?: number;
  speciesId: number;
  heldItemId: number;
  exp: number;
  friendship: number;
  nickname: string;
  otName: string;
  moves: [number, number, number, number];
  movePPs?: [number, number, number, number];
  ivs: IVs;
  evs?: EVs;
  pokerus?: number;
  metLocation?: number;
  metLevel?: number;
  ballCaughtWith?: number;
  otGender?: number;
  abilityBit?: number;
  language?: number;
  ribbons?: number;
}): Uint8Array {
  const raw80 = new Uint8Array(80);
  
  const trainerId = params.trainerId & 0xFFFF;
  const secretId = (params.secretId ?? 0) & 0xFFFF;
  
  // Write PID and OT ID (plaintext)
  writeU32LE(raw80, 0x00, params.pid);
  writeU16LE(raw80, 0x04, trainerId);
  writeU16LE(raw80, 0x06, secretId);
  
  // Write nickname and OT name (plaintext)
  const nicknameBytes = encodeGen3String(params.nickname || "", 10);
  const otNameBytes = encodeGen3String(params.otName || "", 7);
  raw80.set(nicknameBytes, 0x08);
  raw80.set(otNameBytes, 0x14);
  
  // Language at 0x12-0x13
  writeU16LE(raw80, 0x12, params.language ?? 0x0201);
  
  // Build the 4 substructures in LOGICAL order
  const growth = new Uint8Array(12);
  // CRITICAL: Convert National Dex ID to Gen 3 internal index before writing
  // Gen 3 stores species as internal index (Hoenn Pokemon are shuffled!)
  const speciesIndex = natDexToGen3Index(params.speciesId);
  console.log(`[PK3 Build] Input speciesId=${params.speciesId} → Gen3 Index=${speciesIndex}, nickname="${params.nickname}"`);
  
  // Debug logging for Snorlax (#143) to diagnose crash
  if (params.speciesId === 143) {
    console.log(`[SNORLAX DEBUG] Full build params:`, {
      speciesId: params.speciesId,
      speciesIndex,
      heldItemId: params.heldItemId,
      exp: params.exp,
      friendship: params.friendship,
      moves: params.moves,
      movePPs: params.movePPs,
      ivs: params.ivs,
      evs: params.evs,
      metLocation: params.metLocation,
      metLevel: params.metLevel,
      ballCaughtWith: params.ballCaughtWith,
      pid: `0x${params.pid.toString(16)}`,
      trainerId: params.trainerId
    });
  }
  
  writeU16LE(growth, 0x00, speciesIndex);
  writeU16LE(growth, 0x02, params.heldItemId);
  writeU32LE(growth, 0x04, params.exp);
  growth[0x08] = 0; // PP bonuses
  growth[0x09] = params.friendship;
  
  const attacks = new Uint8Array(12);
  writeU16LE(attacks, 0x00, params.moves[0] || 0);
  writeU16LE(attacks, 0x02, params.moves[1] || 0);
  writeU16LE(attacks, 0x04, params.moves[2] || 0);
  writeU16LE(attacks, 0x06, params.moves[3] || 0);
  attacks[0x08] = params.movePPs?.[0] ?? 0;
  attacks[0x09] = params.movePPs?.[1] ?? 0;
  attacks[0x0a] = params.movePPs?.[2] ?? 0;
  attacks[0x0b] = params.movePPs?.[3] ?? 0;
  
  const evCondition = new Uint8Array(12);
  const evs = params.evs ?? { hp: 0, atk: 0, def: 0, spe: 0, spa: 0, spd: 0 };
  evCondition[0] = evs.hp;
  evCondition[1] = evs.atk;
  evCondition[2] = evs.def;
  evCondition[3] = evs.spe;
  evCondition[4] = evs.spa;
  evCondition[5] = evs.spd;
  // Contest stats (bytes 6-11) - initialize to 0
  evCondition[6] = 0; // Coolness
  evCondition[7] = 0; // Beauty
  evCondition[8] = 0; // Cuteness
  evCondition[9] = 0; // Smartness
  evCondition[10] = 0; // Toughness
  evCondition[11] = 0; // Feel
  
  const misc = new Uint8Array(12);
  misc[0x00] = params.pokerus ?? 0;
  misc[0x01] = params.metLocation ?? 0;
  
  // Origins Info (2 bytes at 0x02-0x03): metLevel (bits 0-6), ball (bits 11-14), OT gender (bit 15)
  const originsInfo = ((params.metLevel ?? 0) & 0x7F) |             // bits 0-6: met level
                      (((params.ballCaughtWith ?? 4) & 0x0F) << 11) | // bits 11-14: ball
                      (((params.otGender ?? 0) & 0x01) << 15);        // bit 15: OT gender
  writeU16LE(misc, 0x02, originsInfo);
  
  // Pack IVs into 32-bit word at offset 0x04
  const ivWord = (params.ivs.hp & 0x1f) |
                 ((params.ivs.atk & 0x1f) << 5) |
                 ((params.ivs.def & 0x1f) << 10) |
                 ((params.ivs.spe & 0x1f) << 15) |
                 ((params.ivs.spa & 0x1f) << 20) |
                 ((params.ivs.spd & 0x1f) << 25) |
                 ((params.abilityBit ?? 0) << 31);
  writeU32LE(misc, 0x04, ivWord);
  
  writeU32LE(misc, 0x08, params.ribbons ?? 0);
  
  // Combine blocks in logical order
  const plain = new Uint8Array(48);
  plain.set(growth, 0);
  plain.set(attacks, 12);
  plain.set(evCondition, 24);
  plain.set(misc, 36);
  
  // Calculate checksum
  const checksum = checksum16OfPlain48(plain);
  writeU16LE(raw80, 0x1c, checksum);
  
  // SHUFFLE: Inverse of decoder
  // Decoder does: plain[order[physPos] * 12] = dec[physPos * 12]
  // So encoder must do: shuffled[physPos * 12] = plain[order[physPos] * 12]
  const order = SUBSTRUCT_ORDERS[((params.pid % 24) + 24) % 24];
  const shuffled = new Uint8Array(48);
  
  for (let physicalPos = 0; physicalPos < 4; physicalPos++) {
    const logicalBlock = order[physicalPos];
    shuffled.set(
      plain.subarray(logicalBlock * 12, logicalBlock * 12 + 12),
      physicalPos * 12
    );
  }
  
  // Encrypt with XOR key
  const otId32 = (trainerId | (secretId << 16)) >>> 0;
  const key = (params.pid ^ otId32) >>> 0;
  const encrypted = new Uint8Array(48);
  for (let i = 0; i < 48; i += 4) {
    const w = readU32LE(shuffled, i) ^ key;
    writeU32LE(encrypted, i, w);
  }
  
  // Write encrypted data to output
  raw80.set(encrypted, 0x20);
  
  // Security key at 0x50-0x53
  writeU32LE(raw80, 0x50, 0);
  
  // Debug: dump full 80-byte structure for Snorlax
  if (params.speciesId === 143) {
    console.log(`[SNORLAX DEBUG] Full 80-byte PK3 hex dump:`);
    console.log(Array.from(raw80).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log(`[SNORLAX DEBUG] Unshuffled plain blocks (48 bytes):`);
    console.log(Array.from(plain).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log(`[SNORLAX DEBUG] Checksum: 0x${checksum.toString(16).padStart(4, '0')}`);
  }
  
  return raw80;
}

function encodeGen3String(str: string, maxLen: number): Uint8Array {
  const out = new Uint8Array(maxLen);
  out.fill(0xff);
  
  for (let i = 0; i < Math.min(str.length, maxLen); i++) {
    const c = str[i];
    const code = c.charCodeAt(0);
    
    if (code >= 65 && code <= 90) {
      out[i] = 0xbb + (code - 65);
    } else if (code >= 97 && code <= 122) {
      out[i] = 0xd5 + (code - 97);
    } else if (code >= 48 && code <= 57) {
      out[i] = 0xa1 + (code - 48);
    } else if (c === ' ') {
      out[i] = 0x00;
    } else {
      out[i] = 0x00;
    }
  }
  
  return out;
}
