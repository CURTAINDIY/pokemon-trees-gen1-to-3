// src/lib/gen3/debugAzumarill.ts
// Deep diagnostic tool for Bad Egg debugging

import { decodePk3 } from './pk3';
import { listMons } from '../../db/idb';
import type { ProfessorMonRow } from '../../db/idb';
import { deepDumpPk3 } from './pk3DeepDump';

export async function debugAzumarillBadEgg(): Promise<void> {
  console.log('\n🔍 === AZUMARILL BAD EGG DEEP ANALYSIS ===\n');

  // Get Azumarill from database - search by species ID (184) and OT name
  const allMons = await listMons();
  const azumarill = allMons.find(m => m.speciesId === 184 && m.otName === 'TOM');
  
  if (!azumarill) {
    console.error('❌ Azumarill not found in database!');
    console.log('Available Pokemon with OT "TOM":', allMons.filter(m => m.otName === 'TOM').map(m => ({
      id: m.id,
      species: m.speciesId,
      nickname: decodePk3(m.raw80).nickname
    })));
    return;
  }

  console.log(`✅ Found Azumarill: ${azumarill.id}\n`);

  // Get a working Pokemon for comparison (Oddish)
  const oddish = allMons.find(m => m.otName === 'TOM' && m.speciesId === 43);

  console.log('📦 Raw Data Comparison:\n');
  
  // Dump complete Azumarill data
  dumpCompletePk3Analysis(azumarill, 'AZUMARILL (BAD EGG)');
  
  if (oddish) {
    console.log('\n' + '='.repeat(80) + '\n');
    dumpCompletePk3Analysis(oddish, 'ODDISH (WORKING)');
  }

  // Specific checks for Bad Egg causes
  console.log('\n' + '='.repeat(80));
  console.log('🔬 SPECIFIC BAD EGG CHECKS:\n');
  
  const decoded = decodePk3(azumarill.raw80);
  
  // Check 1: Experience vs Level
  checkExperienceLevel(decoded);
  
  // Check 2: Move Legality
  checkMoveLegality(decoded);
  
  // Check 3: Met Location
  checkMetLocation(decoded);
  
  // Check 4: Origin Data
  checkOriginData(azumarill.raw80, decoded);
  
  // Check 5: Ball Index
  checkBallIndex(decoded);
  
  // Check 6: Language/Game Flags
  checkLanguageAndGame(azumarill.raw80);
  
  // Check 7: Held Item
  checkHeldItem(decoded);
  
  // Check 8: Ability
  checkAbility(decoded);

  console.log('\n' + '='.repeat(80));
  console.log('📊 RAW HEX DUMP:\n');
  dumpHex(azumarill.raw80);
  
  console.log('\n' + '='.repeat(80));
  deepDumpPk3(azumarill.raw80);
}

function dumpCompletePk3Analysis(mon: ProfessorMonRow, label: string): void {
  console.log(`\n📋 ${label}`);
  console.log('─'.repeat(80));
  
  const decoded = decodePk3(mon.raw80);
  const raw = mon.raw80;
  
  console.log('🔢 Core Values:');
  console.log(`  PID:              0x${decoded.pid.toString(16).padStart(8, '0').toUpperCase()}`);
  console.log(`  OT ID (combined): 0x${decoded.otId.toString(16).padStart(8, '0').toUpperCase()}`);
  console.log(`  Trainer ID:       ${decoded.trainerId} (0x${decoded.trainerId.toString(16).padStart(4, '0')})`);
  console.log(`  Secret ID:        ${decoded.secretId} (0x${decoded.secretId.toString(16).padStart(4, '0')})`);
  console.log(`  Checksum:         0x${decoded.checksumStored.toString(16).padStart(4, '0')} (${decoded.checksumOk ? '✅ OK' : '❌ BAD'})`);
  
  console.log('\n🎯 Identity:');
  console.log(`  Nickname:         "${decoded.nickname}"`);
  console.log(`  OT Name:          "${decoded.otName}"`);
  console.log(`  Species ID:       ${decoded.speciesId} (National Dex)`);
  console.log(`  Nature:           ${decoded.natureName} (${decoded.nature})`);
  console.log(`  Shiny:            ${decoded.isShiny ? '✨ YES' : 'No'}`);
  
  console.log('\n📊 Stats & Growth:');
  console.log(`  Experience:       ${decoded.experience?.toLocaleString() || 'N/A'}`);
  console.log(`  Met Level:        ${decoded.metLevel || 'N/A'}`);
  console.log(`  Friendship:       ${decoded.friendship || 'N/A'}`);
  
  console.log('\n⚔️ Moves:');
  if (decoded.moves) {
    decoded.moves.forEach((moveId, i) => {
      const pp = decoded.movePPs?.[i] || 0;
      console.log(`  Move ${i + 1}:          ${moveId} (PP: ${pp})`);
    });
  }
  
  console.log('\n🎲 IVs:');
  if (decoded.ivs) {
    console.log(`  HP:  ${decoded.ivs.hp.toString().padStart(2)} / 31`);
    console.log(`  ATK: ${decoded.ivs.atk.toString().padStart(2)} / 31`);
    console.log(`  DEF: ${decoded.ivs.def.toString().padStart(2)} / 31`);
    console.log(`  SPA: ${decoded.ivs.spa.toString().padStart(2)} / 31`);
    console.log(`  SPD: ${decoded.ivs.spd.toString().padStart(2)} / 31`);
    console.log(`  SPE: ${decoded.ivs.spe.toString().padStart(2)} / 31`);
  }
  
  console.log('\n💪 EVs:');
  if (decoded.evs) {
    console.log(`  HP:  ${decoded.evs.hp.toString().padStart(3)}`);
    console.log(`  ATK: ${decoded.evs.atk.toString().padStart(3)}`);
    console.log(`  DEF: ${decoded.evs.def.toString().padStart(3)}`);
    console.log(`  SPA: ${decoded.evs.spa.toString().padStart(3)}`);
    console.log(`  SPD: ${decoded.evs.spd.toString().padStart(3)}`);
    console.log(`  SPE: ${decoded.evs.spe.toString().padStart(3)}`);
    const evTotal = decoded.evs.hp + decoded.evs.atk + decoded.evs.def + 
                    decoded.evs.spa + decoded.evs.spd + decoded.evs.spe;
    console.log(`  Total: ${evTotal}`);
  }
  
  console.log('\n🏥 Other:');
  console.log(`  Held Item:        ${decoded.heldItem || 0}`);
  console.log(`  Ability:          ${decoded.ability} (bit)`);
  console.log(`  Pokerus:          0x${(decoded.pokerus || 0).toString(16).padStart(2, '0')} (has: ${decoded.hasPokerus}, had: ${decoded.hadPokerus})`);
  console.log(`  Met Location:     ${decoded.metLocation || 0}`);
  console.log(`  Ball:             ${decoded.ballCaughtWith || 0}`);
  console.log(`  OT Gender:        ${decoded.otGender === 0 ? 'Male' : 'Female'}`);
  
  // Read additional bytes not decoded by standard decoder
  console.log('\n🔍 Additional Raw Bytes:');
  console.log(`  Language (0x12):  0x${readU16LE(raw, 0x12).toString(16).padStart(4, '0')}`);
  console.log(`  Flags (0x13):     0x${raw[0x13].toString(16).padStart(2, '0')}`);
  console.log(`  Security (0x50):  0x${readU32LE(raw, 0x50).toString(16).padStart(8, '0')}`);
  console.log(`  Origin (0x54+):   ${Array.from(raw.slice(0x54, 0x60)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
}

function checkExperienceLevel(decoded: any): void {
  console.log('1️⃣ Experience vs Level Check:');
  
  const exp = decoded.experience || 0;
  const metLevel = decoded.metLevel || 0;
  
  // Azumarill is FAST experience group: (4 * L^3) / 5
  const calculatedLevel = Math.floor(Math.pow(exp * 5 / 4, 1/3));
  
  console.log(`   Experience:     ${exp.toLocaleString()}`);
  console.log(`   Met Level:      ${metLevel}`);
  console.log(`   Calculated Lvl: ${calculatedLevel} (from exp)`);
  
  if (calculatedLevel !== metLevel) {
    console.log(`   ⚠️  MISMATCH! Game will recalculate level to ${calculatedLevel}`);
    console.log(`   🔥 This could cause Bad Egg if experience is inconsistent!`);
  } else {
    console.log(`   ✅ Level matches experience`);
  }
}

function checkMoveLegality(decoded: any): void {
  console.log('\n2️⃣ Move Legality Check:');
  
  // Azumarill (184) Gen 3 movepool - simplified check
  const azumarillLegalMoves = [
    0, // None
    33, // Tackle
    39, // Tail Whip
    55, // Water Gun
    61, // Bubble
    145, // Bubble Beam
    205, // Rollout
    37, // Double-Edge (via TM)
    // Add more as needed
  ];
  
  if (decoded.moves && decoded.speciesId === 184) {
    decoded.moves.forEach((moveId: number, i: number) => {
      const isLegal = azumarillLegalMoves.includes(moveId) || moveId === 0;
      console.log(`   Move ${i + 1}: ${moveId.toString().padStart(3)} - ${isLegal ? '✅' : '❌ ILLEGAL'}`);
      
      if (!isLegal && moveId !== 0) {
        console.log(`      🔥 ILLEGAL MOVE DETECTED! This causes Bad Egg!`);
      }
    });
  }
}

function checkMetLocation(decoded: any): void {
  console.log('\n3️⃣ Met Location Check:');
  console.log(`   Location: ${decoded.metLocation || 0}`);
  
  if (decoded.metLocation === 0) {
    console.log(`   ⚠️  Location 0 may be invalid for traded Pokemon`);
  } else if ((decoded.metLocation || 0) > 255) {
    console.log(`   ❌ Invalid location value (>255)`);
  } else {
    console.log(`   ✅ Location seems valid`);
  }
}

function checkOriginData(raw: Uint8Array, decoded: any): void {
  console.log('\n4️⃣ Origin Data Check:');
  
  // Origin info is in Misc block after decryption
  // But we can check the language field at 0x12
  const language = readU16LE(raw, 0x12);
  
  console.log(`   Language field:   0x${language.toString(16).padStart(4, '0')}`);
  console.log(`   Met Level:        ${decoded.metLevel || 0}`);
  console.log(`   Met Location:     ${decoded.metLocation || 0}`);
  console.log(`   Ball Caught With: ${decoded.ballCaughtWith || 0}`);
  console.log(`   OT Gender:        ${decoded.otGender === 0 ? 'Male' : 'Female'}`);
  
  // Check origin word more carefully
  // In the encrypted data, after decryption and unshuffling,
  // Misc block offset 0x02-0x03 contains origin info
  // Bits 0-6: Met level
  // Bits 7-14: Met location  
  // Bit 15: Unknown
  console.log(`   Origin validation:`);
  
  // Met location 19 in Gen 3
  // Valid locations vary by game, but 19 should be valid for most
  if (decoded.metLocation === 0) {
    console.log(`      ⚠️  Met location 0 is unusual`);
  } else if (decoded.metLocation > 0 && decoded.metLocation < 88) {
    console.log(`      ✅ Met location in RSE range`);
  } else if (decoded.metLocation >= 88 && decoded.metLocation < 188) {
    console.log(`      ✅ Met location in FRLG range`);
  } else {
    console.log(`      ⚠️  Met location ${decoded.metLocation} may be invalid`);
  }
  
  // Valid language codes: 0x0201 (Japanese), 0x0202 (English), etc.
  if (language === 0 || language === 0xFFFF) {
    console.log(`   ❌ Invalid language code!`);
  } else {
    console.log(`   ✅ Language code looks valid`);
  }
}

function checkBallIndex(decoded: any): void {
  console.log('\n5️⃣ Ball Index Check:');
  console.log(`   Ball: ${decoded.ballCaughtWith || 0}`);
  
  // Valid Gen 3 balls: 1-12 (some gaps)
  const validBalls = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  
  if (!validBalls.includes(decoded.ballCaughtWith || 0)) {
    console.log(`   ❌ Invalid ball index!`);
  } else {
    console.log(`   ✅ Ball index is valid`);
  }
}

function checkLanguageAndGame(raw: Uint8Array): void {
  console.log('\n6️⃣ Language/Game Version Check:');
  
  const language = readU16LE(raw, 0x12);
  const flags = raw[0x13];
  
  console.log(`   Language:  0x${language.toString(16).padStart(4, '0')}`);
  console.log(`   Flags:     0x${flags.toString(16).padStart(2, '0')}`);
  
  // Check if this looks like proper Gen 3 data
  if (language >= 0x0201 && language <= 0x0207) {
    console.log(`   ✅ Valid Gen 3 language code`);
  } else {
    console.log(`   ⚠️  Unusual language code`);
  }
}

function checkHeldItem(decoded: any): void {
  console.log('\n7️⃣ Held Item Check:');
  console.log(`   Item Index: ${decoded.heldItem || 0}`);
  
  // Gen 3 has items 1-376
  if ((decoded.heldItem || 0) > 376) {
    console.log(`   ❌ Item index out of range!`);
  } else {
    console.log(`   ✅ Item index is valid`);
  }
}

function checkAbility(decoded: any): void {
  console.log('\n8️⃣ Ability Check:');
  console.log(`   Ability bit: ${decoded.ability || 0}`);
  
  // Azumarill has Thick Fat (ability 0) or Huge Power (ability 1)
  if (decoded.speciesId === 184) {
    if (decoded.ability === 0 || decoded.ability === 1) {
      console.log(`   ✅ Valid ability for Azumarill`);
    } else {
      console.log(`   ❌ Invalid ability bit!`);
    }
  }
}

function dumpHex(raw: Uint8Array): void {
  console.log('Full 80-byte hex dump:');
  console.log('Offset  00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F');
  console.log('─'.repeat(72));
  
  for (let i = 0; i < raw.length; i += 16) {
    const offset = i.toString(16).padStart(4, '0').toUpperCase();
    const bytes = Array.from(raw.slice(i, i + 16))
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    console.log(`0x${offset}  ${bytes}`);
  }
  
  console.log('\nKey offsets:');
  console.log('  0x00-0x03: PID');
  console.log('  0x04-0x07: OT ID');
  console.log('  0x08-0x11: Nickname');
  console.log('  0x12-0x13: Language');
  console.log('  0x14-0x1A: OT Name');
  console.log('  0x1B:      Markings');
  console.log('  0x1C-0x1D: Checksum');
  console.log('  0x1E-0x1F: Unknown');
  console.log('  0x20-0x4F: Encrypted data (48 bytes)');
  console.log('  0x50-0x53: Security key');
  console.log('  0x54-0x4F: Padding/unknown');
}

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
