// src/stores/professorsPcStore.ts

import { idb, type ProfessorMonRow } from "../db/idb";
import { extractGen1BoxMons } from "../lib/gen1/gen1";
import { extractGen2BoxMons } from "../lib/gen2/gen2";
import { extractGen3BoxMons } from "../lib/gen3/gen3";
import { convertGen1BoxMonToPk3, convertGen2BoxMonToPk3 } from "../lib/transporter/gb_to_pk3";
import { convertGen3BoxMonToPk3 } from "../lib/transporter/gba_to_pk3";
import { sha256Hex } from "../lib/binary/fingerprint";
import { decodePk3 } from "../lib/gen3/pk3";
import { repairPk3Checksum } from "../lib/gen3/pk3Repair";
import { fixPk3Language, isPk3LanguageValid, getPk3Language, getLanguageName } from "../lib/gen3/pk3LanguageFix";
import { fixPk3MetLevel } from "../lib/gen3/pk3MetLevelFix";
import { fixPk3EggBit } from "../lib/gen3/pk3EggBitFix";
import { randomId } from "./savesStore";

function readU16LE(b: Uint8Array, off: number): number {
  return (b[off] | (b[off + 1] << 8)) >>> 0;
}

type ImportStats = {
  totalSeen: number;
  added: number;
  skippedDuplicates: number;
};

async function buildExistingFingerprintSet(): Promise<Set<string>> {
  const rows = await idb.listMons();
  const fps = await Promise.all(
    rows.map(async (r) => r.fingerprint ?? sha256Hex(r.raw80).catch(() => ""))
  );
  const set = new Set<string>();
  for (const fp of fps) if (fp) set.add(fp);
  return set;
}

const GEN3_MAX_SPECIES = 386;

function normalizeNickname(n?: string): string | undefined {
  const s = (n ?? "").trim();
  return s.length ? s : undefined;
}

function verifiedSpeciesId(speciesId: number | null, checksumOk: boolean): number | undefined {
  // Only cache species ID if checksum is valid AND in valid range
  if (!checksumOk) return undefined;
  if (speciesId == null || speciesId < 1 || speciesId > GEN3_MAX_SPECIES) return undefined;
  return speciesId;
}

export async function importSaveToProfessorPc(saveBytes: Uint8Array, label: string): Promise<ImportStats> {
  const createdAt = Date.now();
  const saveId = randomId("save");

  // Build a duplicate filter from existing DB
  const existing = await buildExistingFingerprintSet();

  // Detect source generation
  let sourceGen: "gen1" | "gen2" | "gen3" = "gen3";
  
  // Extract raw mons depending on save type
  let rawMons: Uint8Array[] = [];
  // Gen 3 first (128KB saves)
  try {
    const extracted = extractGen3BoxMons(saveBytes);
    
    // DIAGNOSTIC: Log first 3 Pokemon
    console.log("\n=== IMPORT DIAGNOSTIC ===");
    console.log(`Total extracted: ${extracted.length}`);
    for (let i = 0; i < Math.min(3, extracted.length); i++) {
      const mon = extracted[i];
      const isEmpty = mon.raw80.every(b => b === 0);
      if (!isEmpty) {
        const d = decodePk3(mon.raw80);
        console.log(`\nPokemon #${i + 1}:`);
        console.log(`  Nickname: "${d.nickname}"`);
        console.log(`  Species: ${d.speciesId}`);
        console.log(`  Checksum: ${d.checksumOk ? 'OK' : 'FAILED'}`);
      }
    }
    console.log("=========================\n");
    
    // Filter out empty slots (all zeros)
    rawMons = extracted
      .filter(e => !e.raw80.every(b => b === 0))
      .map(e => e.raw80);
    
    if (rawMons.length > 0) {
      sourceGen = "gen3";
    }
  } catch {
    // ignore
  }

  // If not gen3, try GB/GBC saves
  if (rawMons.length === 0) {
    // Try Gen 2 first (more specific detection)
    try {
      const gen2 = extractGen2BoxMons(saveBytes);
      if (gen2.length > 0) {
        rawMons = gen2.map(convertGen2BoxMonToPk3);
        sourceGen = "gen2";
      }
    } catch {
      // ignore
    }
    
    // If still nothing, try Gen 1
    if (rawMons.length === 0) {
      try {
        const gen1 = extractGen1BoxMons(saveBytes);
        if (gen1.length > 0) {
          rawMons = gen1.map(convertGen1BoxMonToPk3);
          sourceGen = "gen1";
        }
      } catch {
        // ignore
      }
    }
  } else {
    // Convert extracted Gen3 boxed mons into normalized pk3 (still 80 bytes, but this path keeps future options)
    rawMons = rawMons.map(convertGen3BoxMonToPk3);
  }

  console.log(`\n📂 Detected source generation: ${sourceGen.toUpperCase()}`);

  // Save the source save itself (optional but nice for traceability)
  await idb.putSave({ 
    id: saveId, 
    filename: label, 
    createdAt, 
    uploadedAt: createdAt,
    bytes: saveBytes, 
    kind: sourceGen
  });

  const toInsert: ProfessorMonRow[] = [];
  let skippedDuplicates = 0;

  for (const raw80 of rawMons) {
    const fingerprint = await sha256Hex(raw80).catch(() => "");
    if (!fingerprint) continue;

    if (existing.has(fingerprint)) {
      skippedDuplicates++;
      continue;
    }

    const d = decodePk3(raw80);
    const checksumOk = !!d.checksumOk;

    const row: ProfessorMonRow = {
      id: randomId("mon"),
      createdAt,
      sourceSaveId: saveId,
      raw80,

      // Core IDs
      pid: d.pid,
      otId: d.otId,
      trainerId: d.trainerId,
      secretId: d.secretId,

      // Species and basic info
      speciesId: verifiedSpeciesId(d.speciesId, checksumOk),
      nickname: normalizeNickname(d.nickname),
      otName: d.otName || undefined,
      checksumOk,
      isShiny: d.isShiny,

      // Source generation
      sourceGen,

      // Level and experience
      level: d.level,
      metLevel: d.metLevel,
      experience: d.experience,

      // Moves and items
      heldItem: d.heldItem,
      moves: d.moves,
      movePPs: d.movePPs,

      // Nature
      nature: d.nature,
      natureName: d.natureName,

      // IVs
      ivHp: d.ivs?.hp,
      ivAtk: d.ivs?.atk,
      ivDef: d.ivs?.def,
      ivSpa: d.ivs?.spa,
      ivSpd: d.ivs?.spd,
      ivSpe: d.ivs?.spe,

      // EVs
      evHp: d.evs?.hp,
      evAtk: d.evs?.atk,
      evDef: d.evs?.def,
      evSpa: d.evs?.spa,
      evSpd: d.evs?.spd,
      evSpe: d.evs?.spe,

      // Status
      pokerus: d.pokerus,
      hasPokerus: d.hasPokerus,
      hadPokerus: d.hadPokerus,
      friendship: d.friendship,

      // Met info
      ability: d.ability,
      metLocation: d.metLocation,
      ballCaughtWith: d.ballCaughtWith,
      otGender: d.otGender,

      fingerprint,
    };

    existing.add(fingerprint);
    toInsert.push(row);
  }

  // Insert rows one by one using putMon
  for (const row of toInsert) {
    await idb.putMon(row);
  }

  return {
    totalSeen: rawMons.length,
    added: toInsert.length,
    skippedDuplicates,
  };
}

export async function listProfessorMons(): Promise<ProfessorMonRow[]> {
  return idb.listMons();
}

export async function deleteSelectedMons(monIds: string[]): Promise<void> {
  for (const id of monIds) {
    await idb.deleteMon(id);
  }
}

export async function deleteAllProfessorMons(): Promise<void> {
  await idb.clearMons();
}

export async function repairProfessorMonChecksums(monIds: string[]): Promise<{ repaired: number; failed: number }> {
  console.log(`\n🔧 Repairing checksums for ${monIds.length} Pokemon...`);
  
  let repaired = 0;
  let failed = 0;

  for (const id of monIds) {
    const row = await idb.getMon(id);
    if (!row) {
      console.warn(`Pokemon ${id} not found`);
      failed++;
      continue;
    }

    // Make a copy of the raw data to modify
    const raw80Copy = new Uint8Array(row.raw80);
    
    // Attempt to repair the checksum
    const newChecksum = repairPk3Checksum(raw80Copy);
    
    if (newChecksum === null) {
      console.error(`Failed to repair Pokemon ${id}`);
      failed++;
      continue;
    }

    // Decode the repaired data to update metadata
    const decoded = decodePk3(raw80Copy);
    
    console.log(`Pokemon ${id}:`, {
      nickname: decoded.nickname,
      oldChecksum: readU16LE(row.raw80, 0x1C),
      newChecksum,
      decodedStoredChecksum: decoded.checksumStored,
      decodedCalculatedChecksum: decoded.checksumCalculated,
      checksumOk: decoded.checksumOk,
      pid: decoded.pid,
      otId: decoded.otId,
      speciesId: decoded.speciesId,
    });
    
    if (!decoded.checksumOk) {
      console.error(`Checksum still invalid after repair for Pokemon ${id}`);
      console.error(`This likely means the encrypted data itself is corrupted, not just the checksum.`);
      failed++;
      continue;
    }

    // Update the row with repaired data
    const updatedRow: ProfessorMonRow = {
      ...row,
      raw80: raw80Copy,
      checksumOk: true,
      // Update all metadata from the decoded data
      speciesId: decoded.speciesId,
      pid: decoded.pid,
      otId: decoded.otId,
      trainerId: decoded.trainerId,
      secretId: decoded.secretId,
      nickname: decoded.nickname,
      otName: decoded.otName,
      level: decoded.level,
      metLevel: decoded.metLevel,
      heldItem: decoded.heldItem,
      moves: decoded.moves,
      movePPs: decoded.movePPs,
      ivHp: decoded.ivs?.hp,
      ivAtk: decoded.ivs?.atk,
      ivDef: decoded.ivs?.def,
      ivSpa: decoded.ivs?.spa,
      ivSpd: decoded.ivs?.spd,
      ivSpe: decoded.ivs?.spe,
      evHp: decoded.evs?.hp,
      evAtk: decoded.evs?.atk,
      evDef: decoded.evs?.def,
      evSpa: decoded.evs?.spa,
      evSpd: decoded.evs?.spd,
      evSpe: decoded.evs?.spe,
      nature: decoded.nature,
      natureName: decoded.natureName,
      pokerus: decoded.pokerus,
      hasPokerus: decoded.hasPokerus,
      hadPokerus: decoded.hadPokerus,
      friendship: decoded.friendship,
      experience: decoded.experience,
      ability: decoded.ability,
      abilityName: decoded.abilityName,
      metLocation: decoded.metLocation,
      ballCaughtWith: decoded.ballCaughtWith,
      otGender: decoded.otGender,
    };

    await idb.putMon(updatedRow);
    repaired++;
    console.log(`✅ Repaired: ${decoded.nickname || 'Unknown'} (${decoded.speciesId})`);
  }

  console.log(`\n✅ Checksum repair complete: ${repaired} repaired, ${failed} failed`);
  
  return { repaired, failed };
}

/**
 * Comprehensive repair for Bad Egg issues: fixes checksums AND language codes AND met level AND egg bit
 */
export async function repairBadEggIssues(monIds: string[]): Promise<{ 
  repaired: number; 
  failed: number;
  languageFixed: number;
  checksumFixed: number;
  metLevelFixed: number;
  eggBitFixed: number;
}> {
  console.log(`\n🔧 Repairing Bad Egg issues for ${monIds.length} Pokemon...`);
  
  let repaired = 0;
  let failed = 0;
  let languageFixed = 0;
  let checksumFixed = 0;
  let metLevelFixed = 0;
  let eggBitFixed = 0;

  for (const id of monIds) {
    const row = await idb.getMon(id);
    if (!row) {
      console.warn(`Pokemon ${id} not found`);
      failed++;
      continue;
    }

    // Make a copy of the raw data to modify
    const raw80Copy = new Uint8Array(row.raw80);
    let modified = false;
    
    // Get species ID from current row for met level calculation
    const decoded = decodePk3(raw80Copy);
    const speciesId = decoded.speciesId || row.speciesId || 0;
    
    // Step 1: Fix language code if invalid
    const languageCode = getPk3Language(raw80Copy);
    const languageValid = isPk3LanguageValid(raw80Copy);
    
    if (!languageValid) {
      console.log(`🌐 Fixing language for ${row.id}: ${languageCode ? getLanguageName(languageCode) : 'invalid'} → English`);
      fixPk3Language(raw80Copy); // Defaults to English
      languageFixed++;
      modified = true;
    }
    
    // Step 2: Fix met level to match experience (BEFORE recalculating checksum)
    if (speciesId > 0) {
      const metLevelWasFixed = fixPk3MetLevel(raw80Copy, speciesId);
      if (metLevelWasFixed) {
        metLevelFixed++;
        modified = true;
      }
    }
    
    // Step 3: Fix egg bit (CRITICAL for Bad Egg fix!)
    const eggBitWasFixed = fixPk3EggBit(raw80Copy);
    if (eggBitWasFixed) {
      eggBitFixed++;
      modified = true;
    }
    
    // Step 4: Fix checksum (must be LAST since it depends on the data)
    const checksumBefore = readU16LE(raw80Copy, 0x1C);
    const newChecksum = repairPk3Checksum(raw80Copy);
    
    if (newChecksum !== null && newChecksum !== checksumBefore) {
      console.log(`✓ Checksum fixed: 0x${checksumBefore.toString(16)} → 0x${newChecksum.toString(16)}`);
      checksumFixed++;
      modified = true;
    }

    if (!modified) {
      console.log(`✓ ${row.id} already valid, no repairs needed`);
      continue;
    }

    // Decode the repaired data to update metadata
    const decodedFinal = decodePk3(raw80Copy);
    
    if (!decodedFinal.checksumOk) {
      console.error(`❌ Checksum still invalid after repair for Pokemon ${id}`);
      failed++;
      continue;
    }

    // Update the row with repaired data and fresh metadata
    const updatedRow: ProfessorMonRow = {
      ...row,
      raw80: raw80Copy,
      checksumOk: true,
      speciesId: decodedFinal.speciesId,
      pid: decodedFinal.pid,
      otId: decodedFinal.otId,
      trainerId: decodedFinal.trainerId,
      secretId: decodedFinal.secretId,
      nickname: decodedFinal.nickname,
      otName: decodedFinal.otName,
      level: decodedFinal.level,
      metLevel: decodedFinal.metLevel,
      heldItem: decodedFinal.heldItem,
      moves: decodedFinal.moves,
      movePPs: decodedFinal.movePPs,
      ivHp: decodedFinal.ivs?.hp,
      ivAtk: decodedFinal.ivs?.atk,
      ivDef: decodedFinal.ivs?.def,
      ivSpa: decodedFinal.ivs?.spa,
      ivSpd: decodedFinal.ivs?.spd,
      ivSpe: decodedFinal.ivs?.spe,
      evHp: decodedFinal.evs?.hp,
      evAtk: decodedFinal.evs?.atk,
      evDef: decodedFinal.evs?.def,
      evSpa: decodedFinal.evs?.spa,
      evSpd: decodedFinal.evs?.spd,
      evSpe: decodedFinal.evs?.spe,
      nature: decodedFinal.nature,
      natureName: decodedFinal.natureName,
      pokerus: decodedFinal.pokerus,
      hasPokerus: decodedFinal.hasPokerus,
      hadPokerus: decodedFinal.hadPokerus,
      friendship: decodedFinal.friendship,
      experience: decodedFinal.experience,
      ability: decodedFinal.ability,
      abilityName: decodedFinal.abilityName,
      metLocation: decodedFinal.metLocation,
      ballCaughtWith: decodedFinal.ballCaughtWith,
      otGender: decodedFinal.otGender,
    };

    await idb.putMon(updatedRow);
    repaired++;
    console.log(`✅ Fully repaired: ${decodedFinal.nickname || 'Unknown'} (${decodedFinal.speciesId}) - Met Lv ${decodedFinal.metLevel}`);
  }

  console.log(`\n✅ Bad Egg repair complete:`);
  console.log(`   - ${repaired} Pokemon repaired`);
  console.log(`   - ${languageFixed} language codes fixed`);
  console.log(`   - ${metLevelFixed} met levels fixed`);
  console.log(`   - ${eggBitFixed} egg bits fixed`);
  console.log(`   - ${checksumFixed} checksums fixed`);
  console.log(`   - ${failed} failed`);
  
  return { repaired, failed, languageFixed, checksumFixed, metLevelFixed, eggBitFixed };
}

export async function repairProfessorMonMetadata(): Promise<void> {
  const rows = await idb.listMons();
  const repaired: ProfessorMonRow[] = [];

  for (const r of rows) {
    const d = decodePk3(r.raw80);
    const checksumOk = !!d.checksumOk;

    repaired.push({
      ...r,
      // Core IDs
      pid: d.pid,
      otId: d.otId,
      trainerId: d.trainerId,
      secretId: d.secretId,

      // Species and basic info
      speciesId: verifiedSpeciesId(d.speciesId, checksumOk),
      nickname: normalizeNickname(d.nickname),
      otName: d.otName || undefined,
      checksumOk,

      // Level and experience
      level: d.level,
      metLevel: d.metLevel,
      experience: d.experience,

      // Moves and items
      heldItem: d.heldItem,
      moves: d.moves,
      movePPs: d.movePPs,

      // Nature
      nature: d.nature,
      natureName: d.natureName,

      // IVs
      ivHp: d.ivs?.hp,
      ivAtk: d.ivs?.atk,
      ivDef: d.ivs?.def,
      ivSpa: d.ivs?.spa,
      ivSpd: d.ivs?.spd,
      ivSpe: d.ivs?.spe,

      // EVs
      evHp: d.evs?.hp,
      evAtk: d.evs?.atk,
      evDef: d.evs?.def,
      evSpa: d.evs?.spa,
      evSpd: d.evs?.spd,
      evSpe: d.evs?.spe,

      // Status
      pokerus: d.pokerus,
      hasPokerus: d.hasPokerus,
      hadPokerus: d.hadPokerus,
      friendship: d.friendship,

      // Met info
      ability: d.ability,
      metLocation: d.metLocation,
      ballCaughtWith: d.ballCaughtWith,
      otGender: d.otGender,

      fingerprint: r.fingerprint ?? (await sha256Hex(r.raw80).catch(() => undefined)),
    });
  }

  // Update rows one by one using putMon
  for (const row of repaired) {
    await idb.putMon(row);
  }
}

// Compatibility export for SaveVault component
export const professorsPcStore = {
  importFromSave: async (_kind: "gen1" | "gen2" | "gen3", saveId: string, bytes: Uint8Array) => {
    return importSaveToProfessorPc(bytes, `save_${saveId}`);
  },
};
