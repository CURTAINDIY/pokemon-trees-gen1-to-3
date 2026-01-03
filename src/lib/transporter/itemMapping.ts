// src/lib/transporter/itemMapping.ts
// Gen 2 to Gen 3 item index conversion

/**
 * Maps Gen 2 item indices to Gen 3 item indices
 * Gen 2 and Gen 3 use different item numbering systems
 * 
 * Based on:
 * - Gen 2 items: https://bulbapedia.bulbagarden.net/wiki/List_of_items_by_index_number_(Generation_II)
 * - Gen 3 items: https://bulbapedia.bulbagarden.net/wiki/List_of_items_by_index_number_(Generation_III)
 */
export function convertGen2ItemToGen3(gen2ItemId: number): number {
  // 0 = no item in both generations
  if (gen2ItemId === 0) return 0;
  
  // Map common held items from Gen 2 to Gen 3
  const mapping: Record<number, number> = {
    // Balls
    1: 1,     // Master Ball
    2: 2,     // Ultra Ball  
    4: 3,     // Great Ball
    5: 4,     // Poké Ball
    
    // Healing items
    9: 14,    // Antidote
    10: 15,   // Burn Heal
    11: 16,   // Ice Heal
    12: 17,   // Awakening
    13: 18,   // Parlyz Heal
    14: 19,   // Full Restore
    15: 20,   // Max Potion
    16: 21,   // Hyper Potion
    17: 22,   // Super Potion
    18: 13,   // Potion
    20: 86,   // Repel
    21: 36,   // Max Elixir
    26: 63,   // HP Up
    27: 64,   // Protein
    28: 65,   // Iron
    29: 66,   // Carbos
    31: 67,   // Calcium
    32: 68,   // Rare Candy
    33: 75,   // X Accuracy
    38: 23,   // Full Heal
    39: 24,   // Revive
    40: 25,   // Max Revive
    41: 73,   // Guard Spec.
    42: 83,   // Super Repel
    43: 84,   // Max Repel
    44: 74,   // Dire Hit
    46: 26,   // Fresh Water
    47: 27,   // Soda Pop
    48: 28,   // Lemonade
    49: 75,   // X Attack
    51: 76,   // X Defend
    52: 77,   // X Speed
    53: 79,   // X Special
    62: 69,   // PP Up
    63: 34,   // Ether
    64: 35,   // Max Ether
    65: 36,   // Elixir
    72: 29,   // Moomoo Milk
    
    // Held items (power-ups)
    3: 222,   // Bright Powder → Lax Incense (closest equivalent)
    30: 223,  // Lucky Punch
    35: 224,  // Metal Powder
    57: 183,  // Exp. Share
    73: 184,  // Quick Claw
    77: 204,  // Soft Sand
    78: 211,  // Sharp Beak
    82: 212,  // Poison Barb
    83: 205,  // King's Rock
    88: 185,  // Amulet Coin
    91: 186,  // Cleanse Tag
    95: 210,  // Mystic Water
    96: 215,  // Twisted Spoon
    98: 206,  // Black Belt
    100: 207, // Black Glasses
    102: 218, // Pink Bow → Silk Scarf
    103: 226, // Stick
    104: 187, // Smoke Ball
    105: 213, // NeverMeltIce
    106: 209, // Magnet
    108: 202, // Miracle Seed
    110: 106, // Pearl
    111: 107, // Big Pearl
    112: 188, // Everstone
    113: 214, // Spell Tag
    115: 216, // Charcoal
    117: 208, // Scope Lens
    119: 200, // Metal Coat
    120: 217, // Dragon Fang
    122: 201, // Leftovers
    125: 219, // Dragon Scale → Up-Grade (closest)
    128: 45,  // Sacred Ash
    135: 189, // Light Ball
    141: 93,  // Sun Stone
    
    // Evolution stones
    8: 94,    // Moon Stone
    22: 95,   // Fire Stone
    23: 96,   // Thunder Stone
    24: 97,   // Water Stone
    34: 98,   // Leaf Stone
    
    // Berries (Gen 2 berries → Gen 3 Berry Juice or closest equivalent)
    75: 44,   // PSNCureBerry → Berry Juice
    79: 44,   // PRZCureBerry → Berry Juice
    80: 44,   // Burnt Berry → Berry Juice
    81: 44,   // Ice Berry → Berry Juice
    84: 44,   // Bitter Berry → Berry Juice
    85: 44,   // Mint Berry → Berry Juice
    124: 44,  // Mystery Berry → Berry Juice
    145: 44,  // Berry → Berry Juice
    146: 44,  // Gold Berry → Berry Juice
  };
  
  return mapping[gen2ItemId] || 0; // Return 0 (no item) if no mapping exists
}
