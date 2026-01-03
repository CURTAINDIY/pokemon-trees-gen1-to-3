// src/lib/gen3/diagnose_save.ts
// Diagnostic tool to analyze what's actually in a save file

import { extractGen3BoxMons } from "./gen3";
import { decodePk3 } from "./pk3";
import { speciesName } from "../dex/dex";
import { detectSaveType } from "../saveDetector";
import { diagnoseGen2Save } from "../gen2/diagnose_gen2";
import { extractGen1BoxMons } from "../gen1/gen1";
import { normalizeGen2Save, looksLikeGen2Box, GEN2_PLAYER_NAME_LOC } from "../gen2/gen2";
import { detectGen1Save } from "../gen1/gen1";

function diagnoseGen2Detection(saveBytes: Uint8Array): void {
  const data = saveBytes.length === 0x8000 ? saveBytes : 
               saveBytes.length === 0x10000 ? saveBytes.slice(0x8000) :
               saveBytes.length > 0x8000 ? saveBytes.slice(saveBytes.length - 0x8000) : saveBytes;
  
  console.log(`  Normalized to: ${data.length} bytes`);
  
  // Check player name region
  const playerNameRegion = data.slice(GEN2_PLAYER_NAME_LOC, GEN2_PLAYER_NAME_LOC + 11);
  console.log(`  Player name region (0x${GEN2_PLAYER_NAME_LOC.toString(16)}):`, 
    Array.from(playerNameRegion).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
  
  let hasValidNameChar = false;
  for (let i = 0; i < playerNameRegion.length; i++) {
    const c = playerNameRegion[i];
    if (c === 0x50) break;
    if ((c >= 0x80 && c <= 0xF6) || c === 0x50) {
      hasValidNameChar = true;
      break;
    }
  }
  
  if (hasValidNameChar) {
    console.log(`  ✓ Player name region has valid Gen 2 characters`);
  } else {
    console.log(`  ✗ Player name region has NO valid Gen 2 characters (need 0x50 or 0x80-0xF6)`);
  }
  
  // Check box structures
  const boxLocations = [
    { name: "Current Box", offset: 0x4000 },
    { name: "Box 1", offset: 0x6000 }
  ];
  
  let anyValidBox = false;
  for (const loc of boxLocations) {
    if (loc.offset + 22 > data.length) {
      console.log(`  ${loc.name} (0x${loc.offset.toString(16)}): OUT OF BOUNDS`);
      continue;
    }
    
    const count = data[loc.offset];
    const terminator = data[loc.offset + 21];
    const looksValid = looksLikeGen2Box(data, loc.offset);
    
    console.log(`  ${loc.name} (0x${loc.offset.toString(16)}):`);
    console.log(`    Count: ${count}`);
    console.log(`    Species list (bytes 1-20): ${Array.from(data.slice(loc.offset + 1, loc.offset + 21)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    console.log(`    Terminator @21: 0x${terminator.toString(16).padStart(2, '0')} ${terminator === 0xFF ? '✓' : `✗ (expected 0xFF, got 0x${terminator.toString(16).padStart(2, '0')})`}`);
    console.log(`    Looks valid: ${looksValid ? '✓' : '✗'}`);
    
    if (!looksValid && count > 0 && count <= 20) {
      console.log(`    ⚠️ Count looks reasonable (${count}) but structure validation failed`);
      console.log(`    First 64 bytes of box structure:`);
      console.log(`      ${Array.from(data.slice(loc.offset, loc.offset + 64)).map((b, i) => 
        `${i.toString().padStart(2, ' ')}:${b.toString(16).padStart(2, '0')}`
      ).join(' ')}`);
    }
    
    if (looksValid) anyValidBox = true;
  }
  
  if (!hasValidNameChar) {
    console.log(`  ⚠️ REASON: Player name region check failed`);
  } else if (!anyValidBox) {
    console.log(`  ⚠️ REASON: No valid box structures found`);
  }
}

function diagnoseGen1Detection(saveBytes: Uint8Array): void {
  const data = saveBytes.length === 0x8000 ? saveBytes : saveBytes;
  const isGen1 = detectGen1Save(data);
  console.log(`  Gen 1 detection: ${isGen1 ? '✓ PASSED' : '✗ FAILED'}`);
}

export function diagnoseSave(saveBytes: Uint8Array, maxPokemon: number = 10): void {
  console.log(`Save size: ${saveBytes.length} bytes (0x${saveBytes.length.toString(16).toUpperCase()})`);
  
  // Strip 16-byte header if present
  if (saveBytes.length === 131088) {
    console.log('⚠️ Detected 16-byte header in diagnostics, stripping...');
    saveBytes = saveBytes.slice(16);
  }
  
  const saveType = detectSaveType(saveBytes);
  console.log(`Detected save type: ${saveType.toUpperCase()}`);
  console.log("=".repeat(50));
  
  // If unknown, show detailed detection failures
  if (saveType === 'unknown') {
    console.log("\n🔍 DETECTION ANALYSIS:");
    console.log("=".repeat(50));
    
    if (saveBytes.length === 0x8000 || saveBytes.length === 0x10000) {
      console.log("✓ Size matches Gen 1/Gen 2 (32KB)");
      console.log("\n--- Checking Gen 2 Detection ---");
      diagnoseGen2Detection(saveBytes);
      console.log("\n--- Checking Gen 1 Detection ---");
      diagnoseGen1Detection(saveBytes);
    } else if (saveBytes.length === 0x20000) {
      console.log("✓ Size matches Gen 3 (128KB)");
      console.log("✗ Gen 3 detection failed");
    } else {
      console.log(`✗ Unexpected save size: ${saveBytes.length} bytes`);
    }
    
    console.log("\n" + "=".repeat(50));
    console.error(`❌ Unable to detect save type`);
    console.log("\nFirst 64 bytes of save file:");
    console.log(Array.from(saveBytes.slice(0, 64)).map((b, i) => 
      `${i.toString(16).padStart(4, '0')}: ${b.toString(16).padStart(2, '0')}`
    ).join('\n'));
    return;
  }
  
  if (saveType === 'gen2') {
    diagnoseGen2Save(saveBytes, maxPokemon);
    return;
  }
  
  if (saveType === 'gen1') {
    console.log("=== Gen1 Save Diagnostics ===");
    try {
      const extracted = extractGen1BoxMons(saveBytes);
      const nonEmpty = extracted.filter(e => !e.raw.every(b => b === 0));
      console.log(`Total Pokemon found: ${nonEmpty.length}`);
      console.log(`First ${Math.min(maxPokemon, nonEmpty.length)} Pokemon:`);
      nonEmpty.slice(0, maxPokemon).forEach((mon, i) => {
        console.log(`#${i + 1} - Box ${mon.box + 1}, Slot ${mon.slot + 1}`);
        console.log(`  Species ID: ${mon.raw[0]} (${speciesName(mon.raw[0])})`);
        console.log(`  Level: ${mon.raw[31] || '?'}`);
      });
    } catch (err) {
      console.error("Failed to extract Gen 1 Pokemon:", err);
    }
    return;
  }
  
  if (saveType === 'gen3') {
    console.log("=== Gen3 Save Diagnostics ===");
    try {
      const extracted = extractGen3BoxMons(saveBytes);
    const nonEmpty = extracted.filter(e => !e.raw80.every(b => b === 0));
    
    console.log(`\nTotal Pokemon found: ${nonEmpty.length}`);
    console.log(`\nFirst ${Math.min(maxPokemon, nonEmpty.length)} Pokemon:\n`);
    
    for (let i = 0; i < Math.min(maxPokemon, nonEmpty.length); i++) {
      const mon = nonEmpty[i];
      const decoded = decodePk3(mon.raw80);
      
      console.log(`#${i + 1} - Box ${mon.box + 1}, Slot ${mon.slot + 1}`);
      console.log(`  Nickname: "${decoded.nickname}"`);
      console.log(`  OT Name: "${decoded.otName}"`);
      console.log(`  Species ID: ${decoded.speciesId} (${speciesName(decoded.speciesId)})`);
      console.log(`  PID: 0x${decoded.pid.toString(16).padStart(8, '0').toUpperCase()}`);
      console.log(`  OTID: ${decoded.otId}`);
      console.log(`  Checksum: ${decoded.checksumOk ? 'OK' : 'FAILED'} (stored=0x${decoded.checksumStored.toString(16)}, calc=0x${decoded.checksumCalculated.toString(16)})`);
      
      // Show raw bytes of nickname (offsets 0x08-0x11)
      const nickBytes = mon.raw80.slice(0x08, 0x08 + 10);
      console.log(`  Nickname bytes: ${Array.from(nickBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      // Show raw bytes of species (after unshuffle, Growth block offset 0x00)
      console.log(`  Raw80 first 16 bytes: ${Array.from(mon.raw80.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      console.log('');
    }
    } catch (err) {
      console.error("Failed to extract Gen 3 Pokemon:", err);
    }
    return;
  }
  
  console.error(`❌ Unknown or unsupported save type: ${saveType}`);
  console.log("\nFirst 64 bytes of save file:");
  console.log(Array.from(saveBytes.slice(0, 64)).map((b, i) => 
    `${i.toString(16).padStart(4, '0')}: ${b.toString(16).padStart(2, '0')}`
  ).join('\n'));
}

// Browser-friendly version that works with File input
export function diagnoseSaveFromFile(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      diagnoseSave(bytes);
      resolve();
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
