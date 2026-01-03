// Simple roundtrip test to prove encoder/decoder are inverses
import { buildPk3BoxMon, decodePk3 } from './pk3';

const testSpecies = 258; // Mudkip
const testPid = 1083858561; // From user's actual data

console.log("=== PK3 Encoder/Decoder Roundtrip Test ===\n");

const original = {
  pid: testPid,
  trainerId: 12345,
  speciesId: testSpecies,
  heldItemId: 0,
  exp: 1000,
  friendship: 70,
  nickname: "TEST",
  otName: "TRAINER",
  moves: [33, 45, 0, 0] as [number, number, number, number],
  ivs: { hp: 31, atk: 30, def: 29, spe: 28, spa: 27, spd: 26 },
};

console.log(`Original species: ${original.speciesId} (Mudkip)`);
console.log(`PID: ${original.pid}, PID%24 = ${original.pid % 24}`);

const encoded = buildPk3BoxMon(original);
console.log(`\nEncoded to ${encoded.length} bytes`);

const decoded = decodePk3(encoded);
console.log(`\nDecoded species: ${decoded.speciesId}`);
console.log(`Decoded checksum OK: ${decoded.checksumOk}`);
console.log(`Decoded nickname: "${decoded.nickname}"`);

if (decoded.speciesId === original.speciesId && decoded.checksumOk) {
  console.log("\n✅ SUCCESS: Round-trip preserves species ID!");
} else {
  console.log(`\n❌ FAILED: Expected species ${original.speciesId}, got ${decoded.speciesId}`);
  console.log("This proves the encoder/decoder are not proper inverses.");
}
