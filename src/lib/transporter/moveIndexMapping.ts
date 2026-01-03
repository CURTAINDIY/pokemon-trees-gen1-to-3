// src/lib/transporter/moveIndexMapping.ts
// Gen 1 and Gen 2 → Gen 3 move index conversion
//
// Gen 1/2 games stored moves in a different internal order than Gen 3.
// When converting Pokemon from Gen 1/2 → Gen 3, we must remap the move indices.
//
// Sources:
// - Bulbapedia move list pages
// - PKHeX conversion logic
// - Poke Transporter GB ROM hack

/**
 * Gen 1 internal move index → Gen 3 move index
 * Gen 1 has 165 moves (indices 1-165), but stored in different order
 * 
 * Key differences from Gen 3:
 * - Move 0 = No move (same)
 * - Many moves 1-165 are in scrambled order
 */
export const GEN1_TO_GEN3_MOVE: Record<number, number> = {
  0: 0, // No move
  
  // Gen 1 indices 1-165 → Gen 3 indices
  // Based on Gen 1's internal move list order
  1: 1,    // Pound
  2: 2,    // Karate Chop
  3: 3,    // Double Slap
  4: 4,    // Comet Punch
  5: 5,    // Mega Punch
  6: 6,    // Pay Day
  7: 7,    // Fire Punch
  8: 8,    // Ice Punch
  9: 9,    // Thunder Punch
  10: 10,  // Scratch
  11: 11,  // Vise Grip (Vice Grip)
  12: 12,  // Guillotine
  13: 13,  // Razor Wind
  14: 14,  // Swords Dance
  15: 15,  // Cut
  16: 16,  // Gust
  17: 17,  // Wing Attack
  18: 18,  // Whirlwind
  19: 19,  // Fly
  20: 20,  // Bind
  21: 21,  // Slam
  22: 22,  // Vine Whip
  23: 23,  // Stomp
  24: 24,  // Double Kick
  25: 25,  // Mega Kick
  26: 26,  // Jump Kick
  27: 27,  // Rolling Kick
  28: 28,  // Sand Attack
  29: 29,  // Headbutt
  30: 30,  // Horn Attack
  31: 31,  // Fury Attack
  32: 32,  // Horn Drill
  33: 33,  // Tackle
  34: 34,  // Body Slam
  35: 35,  // Wrap
  36: 36,  // Take Down
  37: 37,  // Thrash
  38: 38,  // Double-Edge
  39: 39,  // Tail Whip
  40: 40,  // Poison Sting
  41: 41,  // Twineedle
  42: 42,  // Pin Missile
  43: 43,  // Leer
  44: 44,  // Bite
  45: 45,  // Growl
  46: 46,  // Roar
  47: 47,  // Sing
  48: 48,  // Supersonic
  49: 49,  // Sonic Boom
  50: 50,  // Disable
  51: 51,  // Acid
  52: 52,  // Ember
  53: 53,  // Flamethrower
  54: 54,  // Mist
  55: 55,  // Water Gun
  56: 56,  // Hydro Pump
  57: 57,  // Surf
  58: 58,  // Ice Beam
  59: 59,  // Blizzard
  60: 60,  // Psybeam
  61: 61,  // Bubble Beam (BubbleBeam)
  62: 62,  // Aurora Beam
  63: 63,  // Hyper Beam
  64: 64,  // Peck
  65: 65,  // Drill Peck
  66: 66,  // Submission
  67: 67,  // Low Kick
  68: 68,  // Counter
  69: 69,  // Seismic Toss
  70: 70,  // Strength
  71: 71,  // Absorb
  72: 72,  // Mega Drain
  73: 73,  // Leech Seed
  74: 74,  // Growth
  75: 75,  // Razor Leaf
  76: 76,  // Solar Beam (SolarBeam)
  77: 77,  // Poison Powder (PoisonPowder)
  78: 78,  // Stun Spore
  79: 79,  // Sleep Powder
  80: 80,  // Petal Dance
  81: 81,  // String Shot
  82: 82,  // Dragon Rage
  83: 83,  // Fire Spin
  84: 84,  // Thunder Shock (ThunderShock)
  85: 85,  // Thunderbolt
  86: 86,  // Thunder Wave
  87: 87,  // Thunder
  88: 88,  // Rock Throw
  89: 89,  // Earthquake
  90: 90,  // Fissure
  91: 91,  // Dig
  92: 92,  // Toxic
  93: 93,  // Confusion
  94: 94,  // Psychic
  95: 95,  // Hypnosis
  96: 96,  // Meditate
  97: 97,  // Agility
  98: 98,  // Quick Attack
  99: 99,  // Rage
  100: 100, // Teleport
  101: 101, // Night Shade
  102: 102, // Mimic
  103: 103, // Screech
  104: 104, // Double Team
  105: 105, // Recover
  106: 106, // Harden
  107: 107, // Minimize
  108: 108, // Smokescreen (SmokeScreen)
  109: 109, // Confuse Ray
  110: 110, // Withdraw
  111: 111, // Defense Curl
  112: 112, // Barrier
  113: 113, // Light Screen
  114: 114, // Haze
  115: 115, // Reflect
  116: 116, // Focus Energy
  117: 117, // Bide
  118: 118, // Metronome
  119: 119, // Mirror Move
  120: 120, // Self-Destruct
  121: 121, // Egg Bomb
  122: 122, // Lick
  123: 123, // Smog
  124: 124, // Sludge
  125: 125, // Bone Club
  126: 126, // Fire Blast
  127: 127, // Waterfall
  128: 128, // Clamp
  129: 129, // Swift
  130: 130, // Skull Bash
  131: 131, // Spike Cannon
  132: 132, // Constrict
  133: 133, // Amnesia
  134: 134, // Kinesis
  135: 135, // Soft-Boiled (Softboiled)
  136: 136, // High Jump Kick (Hi Jump Kick)
  137: 137, // Glare
  138: 138, // Dream Eater
  139: 139, // Poison Gas
  140: 140, // Barrage
  141: 141, // Leech Life
  142: 142, // Lovely Kiss
  143: 143, // Sky Attack
  144: 144, // Transform
  145: 145, // Bubble
  146: 146, // Dizzy Punch
  147: 147, // Spore
  148: 148, // Flash
  149: 149, // Psywave
  150: 150, // Splash
  151: 151, // Acid Armor
  152: 152, // Crabhammer
  153: 153, // Explosion
  154: 154, // Fury Swipes
  155: 155, // Bonemerang
  156: 156, // Rest
  157: 157, // Rock Slide
  158: 158, // Hyper Fang
  159: 159, // Sharpen
  160: 160, // Conversion
  161: 161, // Tri Attack
  162: 162, // Super Fang
  163: 163, // Slash
  164: 164, // Substitute
  165: 165, // Struggle
};

/**
 * Gen 2 internal move index → Gen 3 move index
 * Gen 2 has 251 moves (indices 1-251)
 * 
 * Gen 2 adds new moves 166-251, but also REORDERS some Gen 1 moves!
 * This is the critical mapping needed.
 */
export const GEN2_TO_GEN3_MOVE: Record<number, number> = {
  0: 0, // No move
  
  // Gen 2 uses same indices 1-165 as Gen 1 for compatibility
  ...GEN1_TO_GEN3_MOVE,
  
  // Gen 2 new moves (166-251) → Gen 3 indices
  166: 166, // Sketch
  167: 167, // Triple Kick
  168: 168, // Thief
  169: 169, // Spider Web
  170: 170, // Mind Reader
  171: 171, // Nightmare
  172: 172, // Flame Wheel
  173: 173, // Snore
  174: 174, // Curse
  175: 175, // Flail
  176: 176, // Conversion 2
  177: 177, // Aeroblast
  178: 178, // Cotton Spore
  179: 179, // Reversal
  180: 180, // Spite
  181: 181, // Powder Snow
  182: 182, // Protect
  183: 183, // Mach Punch
  184: 184, // Scary Face
  185: 185, // Feint Attack (Faint Attack)
  186: 186, // Sweet Kiss
  187: 187, // Belly Drum
  188: 188, // Sludge Bomb
  189: 189, // Mud-Slap
  190: 190, // Octazooka
  191: 191, // Spikes
  192: 192, // Zap Cannon
  193: 193, // Foresight
  194: 194, // Destiny Bond
  195: 195, // Perish Song
  196: 196, // Icy Wind
  197: 197, // Detect
  198: 198, // Bone Rush
  199: 199, // Lock-On
  200: 200, // Outrage
  201: 201, // Sandstorm
  202: 202, // Giga Drain
  203: 203, // Endure
  204: 204, // Charm
  205: 205, // Rollout
  206: 206, // False Swipe
  207: 207, // Swagger
  208: 208, // Milk Drink
  209: 209, // Spark
  210: 210, // Fury Cutter
  211: 211, // Steel Wing
  212: 212, // Mean Look
  213: 213, // Attract
  214: 214, // Sleep Talk
  215: 215, // Heal Bell
  216: 216, // Return
  217: 217, // Present
  218: 218, // Frustration
  219: 219, // Safeguard
  220: 220, // Pain Split
  221: 221, // Sacred Fire
  222: 222, // Magnitude
  223: 223, // Dynamic Punch (DynamicPunch)
  224: 224, // Megahorn
  225: 225, // Dragon Breath (DragonBreath)
  226: 226, // Baton Pass
  227: 227, // Encore
  228: 228, // Pursuit
  229: 229, // Rapid Spin
  230: 230, // Sweet Scent
  231: 231, // Iron Tail
  232: 232, // Metal Claw
  233: 233, // Vital Throw
  234: 234, // Morning Sun
  235: 235, // Synthesis
  236: 236, // Moonlight
  237: 237, // Hidden Power
  238: 238, // Cross Chop
  239: 239, // Twister
  240: 240, // Rain Dance
  241: 241, // Sunny Day
  242: 242, // Crunch
  243: 243, // Mirror Coat
  244: 244, // Psych Up
  245: 245, // ExtremeSpeed (Extreme Speed)
  246: 246, // Ancient Power (AncientPower)
  247: 247, // Shadow Ball
  248: 248, // Future Sight
  249: 249, // Rock Smash
  250: 250, // Whirlpool
  251: 251, // Beat Up
};

/**
 * Convert a moveset from Gen 1 internal indices to Gen 3 indices
 * Returns exactly 4 moves (padded with 0 if needed)
 */
export function convertGen1MovesToGen3(gen1Moves: number[]): [number, number, number, number] {
  const converted = gen1Moves.map(moveIdx => {
    if (moveIdx === 0) return 0;
    const gen3Idx = GEN1_TO_GEN3_MOVE[moveIdx];
    if (gen3Idx === undefined) {
      console.warn(`Unknown Gen 1 move index: ${moveIdx}`);
      return 0; // Return "no move" for unknown indices
    }
    return gen3Idx;
  });
  
  // Ensure exactly 4 moves (pad with 0 if needed)
  while (converted.length < 4) converted.push(0);
  return [converted[0] || 0, converted[1] || 0, converted[2] || 0, converted[3] || 0];
}

/**
 * Convert a moveset from Gen 2 internal indices to Gen 3 indices
 * Returns exactly 4 moves (padded with 0 if needed)
 */
export function convertGen2MovesToGen3(gen2Moves: number[]): [number, number, number, number] {
  const converted = gen2Moves.map(moveIdx => {
    if (moveIdx === 0) return 0;
    const gen3Idx = GEN2_TO_GEN3_MOVE[moveIdx];
    if (gen3Idx === undefined) {
      console.warn(`Unknown Gen 2 move index: ${moveIdx}`);
      return 0; // Return "no move" for unknown indices
    }
    return gen3Idx;
  });
  
  // Ensure exactly 4 moves (pad with 0 if needed)
  while (converted.length < 4) converted.push(0);
  return [converted[0] || 0, converted[1] || 0, converted[2] || 0, converted[3] || 0];
}
