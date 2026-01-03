// Debug script to manually decode a PK3 and see what's in each block

// Test with a "MUDKIP → Surskit" case
// From user data: MUDKIP, Surskit, PID=1083858561, OTID=159612134

const pid = 1083858561;
const otId = 159612134;
const pidMod24 = pid % 24;

console.log("=== Manual Decode Test ===");
console.log(`PID: ${pid} (0x${pid.toString(16)})`);
console.log(`OTID: ${otId} (0x${otId.toString(16)})`);
console.log(`PID % 24: ${pidMod24}`);

const SUBSTRUCT_ORDERS: number[][] = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
  [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0],
  [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0],
];

const order = SUBSTRUCT_ORDERS[pidMod24];
console.log(`Shuffle order: [${order.join(', ')}]`);
console.log(`This means:`);
console.log(`  Physical pos 0 contains logical block ${order[0]}`);
console.log(`  Physical pos 1 contains logical block ${order[1]}`);
console.log(`  Physical pos 2 contains logical block ${order[2]}`);
console.log(`  Physical pos 3 contains logical block ${order[3]}`);

// Expected species IDs
console.log("\n=== Expected vs Actual ===");
console.log("Mudkip (expected): #258 = 0x0102 in little-endian = bytes [0x02, 0x01]");
console.log("Surskit (actual):  #283 = 0x011B in little-endian = bytes [0x1B, 0x01]");
console.log("\nIf decoder reads species from logical block 0 offset 0x00:");
console.log("- Current impl reads: plain[order[physPos] * 12]");
console.log("- Should species be at plain[0] or somewhere else?");
