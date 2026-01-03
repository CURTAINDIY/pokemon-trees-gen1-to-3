// src/lib/gen3/pk3DeepDump.ts
// Complete dump of all PK3 internal data

import { decodePk3 } from './pk3';

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

export function deepDumpPk3(raw80: Uint8Array): void {
  console.log('\n🔬 === COMPLETE PK3 INTERNAL DATA DUMP ===\n');
  
  if (raw80.length !== 80) {
    console.error(`Invalid PK3 size: ${raw80.length}`);
    return;
  }
  
  const decoded = decodePk3(raw80);
  
  // Decrypt and unshuffle to get raw block data
  const pid = readU32LE(raw80, 0x00);
  const otId = readU32LE(raw80, 0x04);
  const key = (pid ^ otId) >>> 0;
  
  const enc48 = raw80.subarray(0x20, 0x20 + 48);
  const dec48 = decrypt48(enc48, key);
  const plain = unshuffle48(dec48, pid);
  
  console.log('📦 UNENCRYPTED HEADER (0x00-0x1F):');
  console.log('─'.repeat(60));
  dumpHexBlock(raw80, 0x00, 0x20, [
    '0x00: PID (4 bytes)',
    '0x04: OT ID (4 bytes)',
    '0x08: Nickname (10 bytes)',
    '0x12: Language (2 bytes)',
    '0x14: OT Name (7 bytes)',
    '0x1B: Markings (1 byte)',
    '0x1C: Checksum (2 bytes)',
    '0x1E: Unknown/Padding (2 bytes)'
  ]);
  
  console.log('\n📦 GROWTH BLOCK (Logical Block 0):');
  console.log('─'.repeat(60));
  const growth = plain.subarray(0, 12);
  dumpHexBlock(growth, 0, 12, [
    '0x00: Species (2 bytes)',
    '0x02: Held Item (2 bytes)',
    '0x04: Experience (4 bytes)',
    '0x08: PP Bonuses (1 byte)',
    '0x09: Friendship (1 byte)',
    '0x0A: Unknown (2 bytes)'
  ]);
  
  console.log('\n📦 ATTACKS BLOCK (Logical Block 1):');
  console.log('─'.repeat(60));
  const attacks = plain.subarray(12, 24);
  dumpHexBlock(attacks, 0, 12, [
    '0x00: Move 1 (2 bytes)',
    '0x02: Move 2 (2 bytes)',
    '0x04: Move 3 (2 bytes)',
    '0x06: Move 4 (2 bytes)',
    '0x08: PP 1 (1 byte)',
    '0x09: PP 2 (1 byte)',
    '0x0A: PP 3 (1 byte)',
    '0x0B: PP 4 (1 byte)'
  ]);
  
  console.log('\n📦 EVs/CONDITION BLOCK (Logical Block 2):');
  console.log('─'.repeat(60));
  const evCondition = plain.subarray(24, 36);
  dumpHexBlock(evCondition, 0, 12, [
    '0x00: HP EV (1 byte)',
    '0x01: ATK EV (1 byte)',
    '0x02: DEF EV (1 byte)',
    '0x03: SPE EV (1 byte)',
    '0x04: SPA EV (1 byte)',
    '0x05: SPD EV (1 byte)',
    '0x06: Contest Stats (6 bytes)'
  ]);
  
  console.log('\n📦 MISC BLOCK (Logical Block 3):');
  console.log('─'.repeat(60));
  const misc = plain.subarray(36, 48);
  dumpHexBlock(misc, 0, 12, [
    '0x00: Pokerus (1 byte)',
    '0x01: Met Location (1 byte)',
    '0x02: Origin Info (2 bytes) [bits 0-6: met level, bit 7-14: location, bit 15: game]',
    '0x04: IVs/Egg/Ability (4 bytes)',
    '0x08: Ribbons/Obedience (4 bytes)'
  ]);
  
  // Detailed analysis of Misc block origin info
  const origin = readU16LE(misc, 0x02);
  const metLevel = origin & 0x7F;
  const originBits = (origin >>> 7) & 0x1FF;
  
  console.log('\n🔍 DETAILED ORIGIN INFO:');
  console.log(`   Raw origin word: 0x${origin.toString(16).padStart(4, '0')} (binary: ${origin.toString(2).padStart(16, '0')})`);
  console.log(`   Met Level (bits 0-6): ${metLevel}`);
  console.log(`   Origin bits (7-15): 0x${originBits.toString(16).padStart(3, '0')}`);
  
  const ivWord = readU32LE(misc, 0x04);
  console.log(`\n🔍 DETAILED IV/ABILITY WORD:`);
  console.log(`   Raw IV word: 0x${ivWord.toString(16).padStart(8, '0')}`);
  console.log(`   Ability bit (31): ${(ivWord >>> 31) & 0x01}`);
  console.log(`   Egg bit (30): ${(ivWord >>> 30) & 0x01}`);
  
  const ribbons = readU32LE(misc, 0x08);
  console.log(`\n🔍 RIBBONS/OBEDIENCE:`);
  console.log(`   Raw ribbons word: 0x${ribbons.toString(16).padStart(8, '0')}`);
  console.log(`   Obedience bit: ${(ribbons >>> 31) & 0x01}`);
  
  console.log('\n📦 FOOTER DATA (0x50+):');
  console.log('─'.repeat(60));
  if (raw80.length > 0x50) {
    dumpHexBlock(raw80, 0x50, raw80.length, [
      '0x50: Status Condition (4 bytes)',
      '0x54: Level (1 byte)',
      '0x55: Pokerus Remaining (1 byte)',
      '0x56: Current HP (2 bytes)',
      '0x58: Max HP (2 bytes)',
      '0x5A: Attack (2 bytes)',
      '0x5C: Defense (2 bytes)',
      '0x5E: Speed (2 bytes)',
      '0x60: Sp. Atk (2 bytes)',
      '0x62: Sp. Def (2 bytes)'
    ]);
  } else {
    console.log('   No footer data (party Pokemon only)');
  }
}

function dumpHexBlock(data: Uint8Array, start: number, end: number, labels: string[]): void {
  const hexStr = Array.from(data.subarray(start, Math.min(end, data.length)))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
  
  console.log(`   Hex: ${hexStr}`);
  console.log(`\n   Layout:`);
  labels.forEach(label => console.log(`      ${label}`));
}
