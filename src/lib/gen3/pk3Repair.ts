// src/lib/gen3/pk3Repair.ts
// Repair corrupted PK3 data by recalculating checksums

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

/**
 * Recalculates and fixes the checksum of a PK3 (80-byte Gen 3 boxed Pokemon).
 * The checksum is stored at offset 0x1C-0x1D and is the sum of 24 u16 words
 * from the DECRYPTED and UNSHUFFLED data section.
 * 
 * @param raw80 The 80-byte PK3 data (will be modified in place)
 * @returns The new checksum value, or null if repair failed
 */
export function repairPk3Checksum(raw80: Uint8Array): number | null {
  if (raw80.length !== 80) {
    console.error(`Invalid PK3 size: ${raw80.length} bytes (expected 80)`);
    return null;
  }

  // Read PID and OTID to calculate decryption key
  const pid = readU32LE(raw80, 0x00);
  const otId = readU32LE(raw80, 0x04);
  const key = (pid ^ otId) >>> 0;

  // Decrypt the 48-byte encrypted section (0x20-0x4F)
  const enc48 = raw80.subarray(0x20, 0x20 + 48);
  const dec48 = decrypt48(enc48, key);

  // Unshuffle to get plain data
  const plain48 = unshuffle48(dec48, pid);

  // Calculate checksum from plain unshuffled data (24 u16 words)
  let checksum = 0;
  for (let i = 0; i < 48; i += 2) {
    checksum = (checksum + readU16LE(plain48, i)) & 0xFFFF;
  }

  // Store the new checksum at offset 0x1C
  const oldChecksum = readU16LE(raw80, 0x1C);
  writeU16LE(raw80, 0x1C, checksum);

  console.log(`Checksum repaired: 0x${oldChecksum.toString(16).padStart(4, '0')} → 0x${checksum.toString(16).padStart(4, '0')}`);

  return checksum;
}

/**
 * Batch repair checksums for multiple Pokemon
 * @param raw80Array Array of 80-byte PK3 data (will be modified in place)
 * @returns Number of Pokemon successfully repaired
 */
export function repairPk3ChecksumBatch(raw80Array: Uint8Array[]): number {
  let repaired = 0;
  for (const raw80 of raw80Array) {
    if (repairPk3Checksum(raw80) !== null) {
      repaired++;
    }
  }
  return repaired;
}
