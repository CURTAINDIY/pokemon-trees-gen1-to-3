// Test to verify the unshuffle fix
// This creates a Pokemon with a specific PID that triggers non-trivial shuffling

import { buildPk3BoxMon, decodePk3 } from './pk3';

// Test with PID % 24 = 5, which gives order [0, 3, 2, 1]
// This means shuffled data has:
//   Physical pos 0: Growth (logical 0)
//   Physical pos 1: Misc (logical 3)  
//   Physical pos 2: EVs (logical 2)
//   Physical pos 3: Attacks (logical 1)

const testPid = 5; // PID % 24 = 5
const testOtId = 12345;
const testSpecies = 25; // Pikachu

const pk3 = buildPk3BoxMon({
  pid: testPid,
  trainerId: testOtId,
  speciesId: testSpecies,
  heldItemId: 0,
  exp: 1000,
  friendship: 70,
  nickname: "PIKACHU",
  otName: "ASH",
  moves: [33, 45, 98, 0],
  ivs: { hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31 },
  metLevel: 5,
});

console.log("Created PK3 with PID:", testPid, "OTID:", testOtId);

const decoded = decodePk3(pk3);

console.log("Decoded species:", decoded.speciesId, "(expected", testSpecies, ")");
console.log("Checksum OK:", decoded.checksumOk);
console.log("Nickname:", decoded.nickname);
console.log("OT Name:", decoded.otName);
console.log("Moves:", decoded.moves);

if (decoded.speciesId === testSpecies && decoded.checksumOk) {
  console.log("\n✅ SUCCESS: Shuffle/unshuffle working correctly!");
} else {
  console.log("\n❌ FAILED: Species mismatch or bad checksum");
  console.log("This indicates the unshuffle algorithm is still broken");
}
