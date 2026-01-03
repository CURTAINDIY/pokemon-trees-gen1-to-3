// Debug: Test shuffle/unshuffle round-trip
// This will help us verify the shuffle algorithm is correct

import { buildPk3BoxMon, decodePk3 } from './pk3';

// Test cases with different PID values to trigger different shuffle orders
const testCases = [
  { pid: 0, order: [0, 1, 2, 3], name: "Identity" },
  { pid: 1, order: [0, 1, 3, 2], name: "Swap EVs/Misc" },
  { pid: 5, order: [0, 3, 2, 1], name: "Complex shuffle" },
];

for (const test of testCases) {
  console.log(`\n=== Test: ${test.name} (PID % 24 = ${test.pid % 24}) ===`);
  console.log(`Expected order: [${test.order.join(', ')}]`);
  
  const originalSpecies = 25; // Pikachu
  const originalMoves = [33, 45, 98, 87];
  
  const pk3 = buildPk3BoxMon({
    pid: test.pid,
    trainerId: 12345,
    speciesId: originalSpecies,
    heldItemId: 13,
    exp: 1000,
    friendship: 70,
    nickname: "PIKACHU",
    otName: "ASH",
    moves: [originalMoves[0], originalMoves[1], originalMoves[2], originalMoves[3]],
    ivs: { hp: 31, atk: 30, def: 29, spe: 28, spa: 27, spd: 26 },
    metLevel: 5,
  });
  
  console.log(`Created PK3, size: ${pk3.length} bytes`);
  
  const decoded = decodePk3(pk3);
  
  console.log(`Decoded:`);
  console.log(`  Species: ${decoded.speciesId} (expected ${originalSpecies})`);
  console.log(`  Checksum OK: ${decoded.checksumOk}`);
  console.log(`  Moves: [${decoded.moves?.join(', ')}]`);
  console.log(`  IVs: HP=${decoded.ivs?.hp} ATK=${decoded.ivs?.atk} DEF=${decoded.ivs?.def}`);
  
  const speciesMatch = decoded.speciesId === originalSpecies;
  const checksumMatch = decoded.checksumOk;
  const movesMatch = decoded.moves?.[0] === originalMoves[0] && 
                     decoded.moves?.[1] === originalMoves[1];
  
  if (speciesMatch && checksumMatch && movesMatch) {
    console.log(`✅ PASS`);
  } else {
    console.log(`❌ FAIL:`);
    if (!speciesMatch) console.log(`   - Species mismatch`);
    if (!checksumMatch) console.log(`   - Checksum failed`);
    if (!movesMatch) console.log(`   - Moves mismatch`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`If all tests PASS, encoder/decoder are correctly inverse operations.`);
console.log(`If any test FAILS, there is still a shuffle/unshuffle bug.`);
