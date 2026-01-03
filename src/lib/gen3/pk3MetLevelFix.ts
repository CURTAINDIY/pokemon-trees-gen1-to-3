// src/lib/gen3/pk3MetLevelFix.ts
// Fix Met Level to match experience for Pokemon

import { getLevelForSpeciesExp } from '../dex/expGroups';

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

// Block order table (same as pk3.ts)
const SUBSTRUCT_ORDERS: number[][] = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
  [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0],
  [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0],
];

function decrypt48(enc: Uint8Array, key: number): Uint8Array {
  const dec = new Uint8Array(48);
  for (let i = 0; i < 48; i += 4) {
    const word = readU32LE(enc, i);
    const plain = (word ^ key) >>> 0;
    dec[i] = plain & 0xff;
    dec[i + 1] = (plain >>> 8) & 0xff;
    dec[i + 2] = (plain >>> 16) & 0xff;
    dec[i + 3] = (plain >>> 24) & 0xff;
  }
  return dec;
}

function encrypt48(plain: Uint8Array, key: number): Uint8Array {
  const enc = new Uint8Array(48);
  for (let i = 0; i < 48; i += 4) {
    const word = readU32LE(plain, i);
    const encrypted = (word ^ key) >>> 0;
    enc[i] = encrypted & 0xff;
    enc[i + 1] = (encrypted >>> 8) & 0xff;
    enc[i + 2] = (encrypted >>> 16) & 0xff;
    enc[i + 3] = (encrypted >>> 24) & 0xff;
  }
  return enc;
}

function unshuffle48(dec48: Uint8Array, pid: number): Uint8Array {
  const order = SUBSTRUCT_ORDERS[pid % 24];
  const plain = new Uint8Array(48);
  for (let i = 0; i < 4; i++) {
    const logicalBlockId = order[i];
    const srcOff = i * 12;
    const dstOff = logicalBlockId * 12;
    plain.set(dec48.subarray(srcOff, srcOff + 12), dstOff);
  }
  return plain;
}

function shuffle48(plain: Uint8Array, pid: number): Uint8Array {
  const order = SUBSTRUCT_ORDERS[pid % 24];
  const shuffled = new Uint8Array(48);
  
  for (let physicalPos = 0; physicalPos < 4; physicalPos++) {
    const logicalBlockId = order[physicalPos];
    const srcOff = logicalBlockId * 12;
    const dstOff = physicalPos * 12;
    shuffled.set(plain.subarray(srcOff, srcOff + 12), dstOff);
  }
  
  return shuffled;
}

/**
 * Fix Met Level in PK3 data to match experience
 * This requires decrypting, modifying Misc block, re-encrypting
 * 
 * @param raw80 The 80-byte PK3 data (will be modified in place)
 * @param speciesId National Dex species ID for experience curve lookup
 * @returns true if met level was fixed, false if already valid or failed
 */
export function fixPk3MetLevel(raw80: Uint8Array, speciesId: number): boolean {
  if (raw80.length !== 80) {
    console.error(`Invalid PK3 size: ${raw80.length} bytes (expected 80)`);
    return false;
  }

  // Read PID, OTID, and current data
  const pid = readU32LE(raw80, 0x00);
  const otId = readU32LE(raw80, 0x04);
  const key = (pid ^ otId) >>> 0;
  
  // Decrypt and unshuffle
  const enc48 = raw80.subarray(0x20, 0x20 + 48);
  const dec48 = decrypt48(enc48, key);
  const plain = unshuffle48(dec48, pid);
  
  // Read experience from Growth block (block 0, offset 0x04)
  const experience = readU32LE(plain, 0x04);
  
  // Read species from Growth block (block 0, offset 0x00)
  // const speciesIndex = readU16LE(plain, 0x00);  // Unused
  
  // Calculate correct level from experience
  const correctLevel = getLevelForSpeciesExp(speciesId, experience);
  
  // Read current met level from Misc block (block 3, offset 0x02, lower 7 bits)
  const misc = plain.subarray(36, 48);
  const origin = readU16LE(misc, 0x02);
  const currentMetLevel = origin & 0x7f;
  
  if (currentMetLevel === correctLevel) {
    console.log(`✅ Met Level already correct: ${currentMetLevel}`);
    return false;
  }
  
  console.log(`🔧 Fixing Met Level: ${currentMetLevel} → ${correctLevel} (exp: ${experience.toLocaleString()})`);
  
  // Update met level (preserve upper bits)
  const newOrigin = (origin & 0xFF80) | (correctLevel & 0x7F);
  writeU16LE(misc, 0x02, newOrigin);
  
  // Write back to plain buffer
  plain.set(misc, 36);
  
  // Re-shuffle and re-encrypt
  const shuffled = shuffle48(plain, pid);
  const encrypted = encrypt48(shuffled, key);
  
  // Write back to raw80
  raw80.set(encrypted, 0x20);
  
  return true;
}
