// gen3.ts
//
// Fixes:
// 1) Correct PC storage extraction/injection:
//    - PC section payload is 0xF80 bytes (not 0xFF4)
//    - Boxed mons stream begins at offset +4 inside concatenated PC payload
// 2) Recompute section footer checksums when writing modified sectors
//
// Notes:
// - Save section footer is always at 0xFF4 (0x74 padding after 0xF80 payload).
// - Section checksum matches real Gen 3 saves: sum u32 over 0xF80, fold to 16-bit.

import { decodePk3 } from './pk3';
import { natureFromPid } from '../dex/dex';

export const GEN3_SAVE_SIZE = 0x20000;

const SAVE_BLOCK_SIZE = 0x0e000;
const SECTOR_SIZE = 0x1000;

// Sector layout
const SECTOR_FOOTER_OFF = 0x0ff4; // 0xF80 payload + 0x74 padding = 0xFF4
const SECTOR_FOOTER_SIZE = 0x0c;
const SECTOR_DATA_SIZE = SECTOR_FOOTER_OFF; // includes payload + padding (0xFF4)
const SECTION_PAYLOAD_SIZE = 0x0f80; // what game uses for checksum/structure

// PC sections
const PC_SECTION_FIRST = 5;
const PC_SECTION_LAST = 13;
const PC_SECTION_COUNT = PC_SECTION_LAST - PC_SECTION_FIRST + 1;

// Boxed PK3 stream
const BOX_COUNT = 14;
const SLOTS_PER_BOX = 30;
const PK3_SIZE = 80;
const PC_TOTAL_BYTES = BOX_COUNT * SLOTS_PER_BOX * PK3_SIZE;

// The boxed-mons stream starts 4 bytes into the concatenated PC payload
const PC_MON_DATA_OFFSET = 4;

// Total bytes available when concatenating the 0xF80 payload from sections 5..13
const PC_BLOB_BYTES = PC_SECTION_COUNT * SECTION_PAYLOAD_SIZE;

export function detectGen3Save(buf: Uint8Array): boolean {
  return buf.byteLength === GEN3_SAVE_SIZE;
}

export type Gen3BoxMon = {
  box: number;  // 0-based (0..13)
  slot: number; // 0-based (0..29)
  raw80: Uint8Array;
};

type Sector = {
  block: number;        // 0 or 1
  index: number;        // sector position within block (0..13)
  sectionId: number;    // 0..13 (but can repeat in corrupt saves)
  checksum: number;     // footer checksum
  signature: number;    // typically 0x08012025
  saveIndex: number;    // save counter
  data: Uint8Array;     // 0xFF4 bytes (payload + padding)
};

function readU16LE(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8);
}
function readU32LE(buf: Uint8Array, off: number): number {
  return (
    buf[off] |
    (buf[off + 1] << 8) |
    (buf[off + 2] << 16) |
    (buf[off + 3] << 24)
  ) >>> 0;
}

function writeU16LE(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >>> 8) & 0xff;
}
function writeU32LE(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >>> 8) & 0xff;
  buf[off + 2] = (v >>> 16) & 0xff;
  buf[off + 3] = (v >>> 24) & 0xff;
}

/**
 * Gen 3 save section checksum:
 * - Sum u32 words over first 0xF80 bytes (payload)
 * - Fold to 16-bit: low16 + high16
 */
function calcSectionChecksum(sectionDataFF4: Uint8Array): number {
  let sum = 0 >>> 0;
  for (let i = 0; i < SECTION_PAYLOAD_SIZE; i += 4) {
    const w = readU32LE(sectionDataFF4, i);
    sum = (sum + w) >>> 0;
  }
  const folded = ((sum & 0xffff) + ((sum >>> 16) & 0xffff)) & 0xffff;
  return folded;
}

function parseSectors(save: Uint8Array): Sector[] {
  const out: Sector[] = [];
  for (let block = 0; block < 2; block++) {
    const base = block * SAVE_BLOCK_SIZE;
    for (let i = 0; i < 14; i++) {
      const sectorBase = base + i * SECTOR_SIZE;
      const sec = save.slice(sectorBase, sectorBase + SECTOR_SIZE);

      const data = sec.slice(0, SECTOR_DATA_SIZE);

      const sectionId = readU16LE(sec, SECTOR_FOOTER_OFF + 0x00);
      const checksum = readU16LE(sec, SECTOR_FOOTER_OFF + 0x02);
      const signature = readU32LE(sec, SECTOR_FOOTER_OFF + 0x04);
      const saveIndex = readU32LE(sec, SECTOR_FOOTER_OFF + 0x08);

      out.push({
        block,
        index: i,
        sectionId,
        checksum,
        signature,
        saveIndex,
        data,
      });
    }
  }
  return out;
}

function selectNewestSaveBlock(sectors: Sector[]): number {
  const byBlock: Record<number, Sector[]> = { 0: [], 1: [] };
  for (const s of sectors) byBlock[s.block].push(s);

  function blockScore(blockSectors: Sector[]): [number, number] {
    const maxIdx = Math.max(...blockSectors.map((s) => s.saveIndex));
    const countAtMax = blockSectors.filter((s) => s.saveIndex === maxIdx).length;
    return [maxIdx, countAtMax];
  }

  const s0 = blockScore(byBlock[0]);
  const s1 = blockScore(byBlock[1]);
  return (s0[0] > s1[0] || (s0[0] === s1[0] && s0[1] >= s1[1])) ? 0 : 1;
}

function getSectorsForChosenBlockNewestIndex(sectors: Sector[], chosenBlock: number): Sector[] {
  const blockSectors = sectors.filter((s) => s.block === chosenBlock);
  const maxIdx = Math.max(...blockSectors.map((s) => s.saveIndex));
  return blockSectors.filter((s) => s.saveIndex === maxIdx);
}

/**
 * Build the full PC payload blob (0xF80 * 9) from sections 5..13.
 * Missing sections are zero-filled.
 */
function buildPcBlob(sectorsNewest: Sector[]): Uint8Array {
  const bySectionId = new Map<number, Sector>();
  for (const s of sectorsNewest) bySectionId.set(s.sectionId, s);

  const blob = new Uint8Array(PC_BLOB_BYTES);
  let off = 0;

  for (let sid = PC_SECTION_FIRST; sid <= PC_SECTION_LAST; sid++) {
    const sec = bySectionId.get(sid);
    if (sec) {
      blob.set(sec.data.slice(0, SECTION_PAYLOAD_SIZE), off);
    } else {
      // leave zeros
    }
    off += SECTION_PAYLOAD_SIZE;
  }

  return blob;
}

function writePcBlobIntoSectors(sectorsNewest: Sector[], pcBlob: Uint8Array): void {
  const bySectionId = new Map<number, Sector>();
  for (const s of sectorsNewest) bySectionId.set(s.sectionId, s);

  let off = 0;
  for (let sid = PC_SECTION_FIRST; sid <= PC_SECTION_LAST; sid++) {
    const sec = bySectionId.get(sid);
    if (!sec) {
      off += SECTION_PAYLOAD_SIZE;
      continue;
    }

    // Preserve the 0x74 padding bytes (0xF80..0xFF4) already in sec.data
    const merged = sec.data.slice(); // 0xFF4
    merged.set(pcBlob.slice(off, off + SECTION_PAYLOAD_SIZE), 0);

    sec.data = merged;
    sec.checksum = calcSectionChecksum(sec.data);

    off += SECTION_PAYLOAD_SIZE;
  }
}

function writeSectorsToSave(save: Uint8Array, sectorsNewest: Sector[]): Uint8Array {
  const out = save.slice(); // copy

  for (const s of sectorsNewest) {
    const sectorBase = s.block * SAVE_BLOCK_SIZE + s.index * SECTOR_SIZE;

    // write data area (0xFF4)
    out.set(s.data, sectorBase);

    // rewrite footer (id, checksum, signature, saveIndex)
    const footer = new Uint8Array(SECTOR_FOOTER_SIZE);
    writeU16LE(footer, 0x00, s.sectionId);
    writeU16LE(footer, 0x02, s.checksum);
    writeU32LE(footer, 0x04, s.signature);
    writeU32LE(footer, 0x08, s.saveIndex);

    out.set(footer, sectorBase + SECTOR_FOOTER_OFF);
    // NOTE: last 0x0C bytes are footer; remainder of 0x1000 is fully defined.
  }

  return out;
}

export function extractGen3BoxMons(save: Uint8Array): Gen3BoxMon[] {
  // Some emulators add a 16-byte header - strip it if present
  if (save.length === 131088) {
    console.log('⚠️ Detected 16-byte header, stripping...');
    save = save.slice(16);
  }
  
  if (save.length !== GEN3_SAVE_SIZE) {
    throw new Error(`Gen 3 save must be ${GEN3_SAVE_SIZE} bytes (128KB), got ${save.length}`);
  }
  
  const sectors = parseSectors(save);
  const chosenBlock = selectNewestSaveBlock(sectors);
  const newest = getSectorsForChosenBlockNewestIndex(sectors, chosenBlock);

  const pcBlob = buildPcBlob(newest);

  // Boxed mons stream
  const start = PC_MON_DATA_OFFSET;
  const end = start + PC_TOTAL_BYTES;
  const pcData = pcBlob.slice(start, end);

  const mons: Gen3BoxMon[] = [];
  let idx = 0;

  for (let box = 0; box < BOX_COUNT; box++) {
    for (let slot = 0; slot < SLOTS_PER_BOX; slot++) {
      const raw80 = pcData.slice(idx, idx + PK3_SIZE);
      idx += PK3_SIZE;

      // Keep empties out (all-zero)
      let any = false;
      for (let i = 0; i < raw80.length; i++) {
        if (raw80[i] !== 0) { any = true; break; }
      }
      if (!any) continue;

      mons.push({ box, slot, raw80 });
    }
  }

  return mons;
}

export function findEmptySlots(save: Uint8Array): Array<{ box: number; slot: number }> {
  const sectors = parseSectors(save);
  const chosenBlock = selectNewestSaveBlock(sectors);
  const newest = getSectorsForChosenBlockNewestIndex(sectors, chosenBlock);

  const pcBlob = buildPcBlob(newest);

  const start = PC_MON_DATA_OFFSET;
  const end = start + PC_TOTAL_BYTES;
  const pcData = pcBlob.slice(start, end);

  const emptySlots: Array<{ box: number; slot: number }> = [];
  let idx = 0;

  for (let box = 0; box < BOX_COUNT; box++) {
    for (let slot = 0; slot < SLOTS_PER_BOX; slot++) {
      const raw80 = pcData.slice(idx, idx + PK3_SIZE);
      idx += PK3_SIZE;

      // Check if slot is empty (PID and checksum are both 0)
      const pid = readU32LE(raw80, 0x00);
      const checksum = readU16LE(raw80, 0x1c);

      if (pid === 0 && checksum === 0) {
        emptySlots.push({ box, slot });
      }
    }
  }

  return emptySlots;
}

export function injectGen3BoxMons(save: Uint8Array, mons: Gen3BoxMon[]): Uint8Array {
  console.log(`\n=== Gen 3 Injection Validation ===`);
  console.log(`Injecting ${mons.length} Pokemon...`);
  
  // Validate each mon before injection
  const validatedMons: Gen3BoxMon[] = [];
  for (let i = 0; i < mons.length; i++) {
    const m = mons[i];
    
    // Basic structural validation
    if (m.box < 0 || m.box >= BOX_COUNT) {
      console.warn(`Mon ${i}: Invalid box ${m.box}, skipping`);
      continue;
    }
    if (m.slot < 0 || m.slot >= SLOTS_PER_BOX) {
      console.warn(`Mon ${i}: Invalid slot ${m.slot}, skipping`);
      continue;
    }
    if (m.raw80.byteLength !== PK3_SIZE) {
      console.warn(`Mon ${i}: Invalid size ${m.raw80.byteLength}, expected ${PK3_SIZE}, skipping`);
      continue;
    }
    
    // Decode and validate PK3 structure
    const decoded = decodePk3(m.raw80);
    
    // Check checksum integrity
    if (!decoded.checksumOk) {
      console.warn(`Mon ${i} (${decoded.nickname}): Checksum mismatch! Stored: 0x${decoded.checksumStored.toString(16)}, Calculated: 0x${decoded.checksumCalculated.toString(16)}`);
      // Allow but warn - some transfers may intentionally modify data
    }
    
    // Validate species ID is in Gen 3 range
    if (decoded.speciesId < 1 || decoded.speciesId > 386) {
      console.warn(`Mon ${i}: Invalid species ${decoded.speciesId}, skipping`);
      continue;
    }
    
    // Validate PID and nature correlation
    const { id: expectedNature } = natureFromPid(decoded.pid);
    if (expectedNature !== decoded.nature) {
      console.warn(`Mon ${i} (${decoded.nickname}): Nature mismatch! PID-derived = ${expectedNature}, decoded nature = ${decoded.nature}`);
    }
    
    // Validate IVs are in range
    if (decoded.ivs) {
      const ivArray = [decoded.ivs.hp, decoded.ivs.atk, decoded.ivs.def, decoded.ivs.spe, decoded.ivs.spa, decoded.ivs.spd];
      const invalidIVs = ivArray.filter(iv => iv < 0 || iv > 31);
      if (invalidIVs.length > 0) {
        console.warn(`Mon ${i} (${decoded.nickname}): Invalid IVs detected`);
      }
    }
    
    // Validate moves exist (0 is valid for "no move")
    if (decoded.moves) {
      const invalidMoves = decoded.moves.filter(m => m < 0 || m > 354);
      if (invalidMoves.length > 0) {
        console.warn(`Mon ${i} (${decoded.nickname}): Invalid move IDs: ${invalidMoves.join(', ')}`);
      }
    }
    
    console.log(`✓ Mon ${i}: ${decoded.nickname || decoded.speciesId} validated (Box ${m.box + 1}, Slot ${m.slot + 1})`);
    validatedMons.push(m);
  }
  
  console.log(`Validated ${validatedMons.length}/${mons.length} Pokemon for injection`);
  console.log(`================================\n`);
  
  const sectors = parseSectors(save);
  const chosenBlock = selectNewestSaveBlock(sectors);
  const newest = getSectorsForChosenBlockNewestIndex(sectors, chosenBlock);

  // Build full PC blob (0xF80*9), preserve everything, patch only mon stream
  const pcBlob = buildPcBlob(newest);
  
  // DEBUG: Log PC header bytes
  console.log(`[PC DEBUG] First 32 bytes of PC blob:`, Array.from(pcBlob.slice(0, 32)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
  console.log(`[PC DEBUG] Bytes at offset 0-3:`, Array.from(pcBlob.slice(0, 4)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));

  const start = PC_MON_DATA_OFFSET;
  const end = start + PC_TOTAL_BYTES;

  const pcData = pcBlob.slice(start, end);

  // Apply patches into pcData buffer (using validated mons only)
  for (const m of validatedMons) {
    const offset = (m.box * SLOTS_PER_BOX + m.slot) * PK3_SIZE;
    pcData.set(m.raw80, offset);
  }

  // Write patched pcData back into pcBlob, preserving header/tail
  pcBlob.set(pcData, start);

  // Split pcBlob back into sections 5..13 and update their checksums
  writePcBlobIntoSectors(newest, pcBlob);

  // Write updated sectors back to the save
  return writeSectorsToSave(save, newest);
}
