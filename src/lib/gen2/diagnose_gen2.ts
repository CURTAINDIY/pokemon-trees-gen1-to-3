// src/lib/gen2/diagnose_gen2.ts
// Gen 2 save diagnostics

import { normalizeGen2Save, extractGen2BoxMons, looksLikeGen2Box, GEN2_PLAYER_NAME_LOC } from './gen2';
import { speciesName } from '../dex/dex';

export function diagnoseGen2Save(saveBytes: Uint8Array, maxPokemon: number = 10): void {
  console.log("=== Gen2 Save Diagnostics ===");
  
  const data = saveBytes.length === 0x8000 ? saveBytes : 
               saveBytes.length === 0x10000 ? saveBytes.slice(0x8000) :
               saveBytes.length > 0x8000 ? saveBytes.slice(saveBytes.length - 0x8000) : saveBytes;
  
  console.log(`Normalized size: ${data.length} bytes`);
  
  // Check detection markers
  console.log("\n--- Detection Markers ---");
  const playerNameRegion = data.slice(GEN2_PLAYER_NAME_LOC, GEN2_PLAYER_NAME_LOC + 11);
  console.log(`Player name region (0x${GEN2_PLAYER_NAME_LOC.toString(16)}):`, 
    Array.from(playerNameRegion).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
  
  // Check box structures
  console.log("\n--- Box Structure Check ---");
  const boxLocations = [
    { name: "Current Box", offset: 0x4000 },
    { name: "Box 1", offset: 0x6000 },
    { name: "Box 2", offset: 0x6000 + 0x450 }
  ];
  
  for (const loc of boxLocations) {
    if (loc.offset + 22 > data.length) {
      console.log(`${loc.name} (0x${loc.offset.toString(16)}): OUT OF BOUNDS`);
      continue;
    }
    
    const count = data[loc.offset];
    const species1 = data[loc.offset + 1];
    const species2 = data[loc.offset + 2];
    const terminator = data[loc.offset + 21];
    
    console.log(`${loc.name} (0x${loc.offset.toString(16)}):`)
    console.log(`  Count: ${count} (0x${count.toString(16).padStart(2, '0')})`);
    console.log(`  First species: ${species1} (0x${species1.toString(16).padStart(2, '0')})`);
    console.log(`  Second species: ${species2} (0x${species2.toString(16).padStart(2, '0')})`);
    console.log(`  Terminator @21: 0x${terminator.toString(16).padStart(2, '0')} ${terminator === 0xFF ? '✓' : '✗ (expected 0xFF)'}`);
  }
  
  // Try extraction
  console.log("\n--- Extraction Attempt ---");
  try {
    const extracted = extractGen2BoxMons(saveBytes);
    const nonEmpty = extracted.filter(e => !e.raw32.every(b => b === 0));
    
    console.log(`\nTotal Pokemon found: ${nonEmpty.length}`);
    console.log(`\nFirst ${Math.min(maxPokemon, nonEmpty.length)} Pokemon:\n`);
    
    for (let i = 0; i < Math.min(maxPokemon, nonEmpty.length); i++) {
      const mon = nonEmpty[i];
      console.log(`#${i + 1}`);
      console.log(`  Gen2 Species ID: ${mon.speciesId} → NatDex ${mon.natDex} (${speciesName(mon.natDex)})`);
      console.log(`  Level: ${mon.level}`);
      console.log(`  OT ID: ${mon.otId16}`);
      console.log(`  Moves: ${mon.moves.filter(m => m > 0).join(', ')}`);
      console.log(`  DVs: 0x${mon.dvs.toString(16).padStart(4, '0')}`);
      console.log('');
    }
  } catch (err) {
    console.error("Failed to extract Gen 2 Pokemon:", err);
  }
}
