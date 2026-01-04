// src/lib/gen1/gen1IndexToNatDex.ts
// Gen 1 internal index to National Dex number mapping
// Source: Bulbapedia - List of Pokémon by index number (Generation I)
// CORRECTED using authoritative reference document

export const gen1IndexToNatDex: { [key: number]: number } = {
  1: 112,   // Rhydon
  2: 115,   // Kangaskhan
  3: 32,    // Nidoran♂
  4: 35,    // Clefairy
  5: 21,    // Spearow
  6: 100,   // Voltorb
  7: 34,    // Nidoking
  8: 80,    // Slowbro
  9: 2,     // Ivysaur
  10: 103,  // Exeggutor
  11: 108,  // Lickitung
  12: 102,  // Exeggcute
  13: 88,   // Grimer
  14: 94,   // Gengar
  15: 29,   // Nidoran♀
  16: 31,    // Nidoqueen
  17: 104,  // Cubone
  18: 111,  // Rhyhorn
  19: 131,  // Lapras
  20: 59,   // Arcanine
  21: 151,  // Mew
  22: 130,  // Gyarados
  23: 90,   // Shellder
  24: 72,   // Tentacool
  25: 92,   // Gastly
  26: 123,  // Scyther
  27: 120,  // Staryu
  28: 9,    // Blastoise
  29: 127,  // Pinsir
  30: 114,  // Tangela
  // 31-32: MissingNo.
  33: 58,   // Growlithe
  34: 95,   // Onix
  35: 22,   // Fearow
  36: 16,   // Pidgey
  37: 79,   // Slowpoke
  38: 64,   // Kadabra
  39: 75,   // Graveler
  40: 113,  // Chansey
  41: 67,   // Machoke
  42: 122,  // Mr. Mime
  43: 106,  // Hitmonlee
  44: 107,  // Hitmonchan
  45: 24,   // Arbok
  46: 47,   // Parasect
  47: 54,   // Psyduck
  48: 96,   // Drowzee
  49: 76,   // Golem
  // 50: MissingNo.
  51: 126,  // Magmar
  // 52: MissingNo.
  53: 125,  // Electabuzz
  54: 82,   // Magneton
  55: 109,  // Koffing
  // 56: MissingNo.
  57: 56,   // Mankey
  58: 86,   // Seel
  59: 50,   // Diglett
  60: 128,  // Tauros
  // 61-63: MissingNo.
  64: 83,   // Farfetch'd
  65: 48,   // Venonat
  66: 149,  // Dragonite
  // 67-69: MissingNo.
  70: 84,   // Doduo
  71: 60,   // Poliwag
  72: 124,  // Jynx
  73: 146,  // Moltres
  74: 144,  // Articuno
  75: 145,  // Zapdos
  76: 132,  // Ditto
  77: 52,   // Meowth
  78: 98,   // Krabby
  // 79-81: MissingNo.
  82: 37,   // Vulpix
  83: 38,   // Ninetales
  84: 25,   // Pikachu
  85: 26,   // Raichu
  // 86-87: MissingNo.
  88: 147,  // Dratini
  89: 148,  // Dragonair
  90: 140,  // Kabuto
  91: 141,  // Kabutops
  92: 116,  // Horsea
  93: 117,  // Seadra
  // 94-95: MissingNo.
  96: 27,   // Sandshrew
  97: 28,   // Sandslash
  98: 138,  // Omanyte
  99: 139,  // Omastar
  100: 39,  // Jigglypuff
  101: 40,  // Wigglytuff
  102: 133, // Eevee
  103: 136, // Flareon
  104: 135, // Jolteon
  105: 134, // Vaporeon
  106: 66,  // Machop
  107: 41,  // Zubat
  108: 23,  // Ekans
  109: 46,  // Paras
  110: 61,  // Poliwhirl
  111: 62,  // Poliwrath
  112: 13,  // Weedle
  113: 14,  // Kakuna
  114: 15,  // Beedrill
  // 115: MissingNo.
  116: 85,  // Dodrio
  117: 57,  // Primeape
  118: 51,  // Dugtrio
  119: 49,  // Venomoth
  120: 87,  // Dewgong
  // 121-122: MissingNo.
  123: 10,  // Caterpie
  124: 11,  // Metapod
  125: 12,  // Butterfree
  126: 68,  // Machamp
  // 127: MissingNo.
  128: 55,  // Golduck
  129: 97,  // Hypno
  130: 42,  // Golbat
  131: 150, // Mewtwo
  132: 143, // Snorlax
  133: 129, // Magikarp
  // 134-135: MissingNo.
  136: 89,  // Muk
  // 137: MissingNo.
  138: 99,  // Kingler
  139: 91,  // Cloyster
  // 140: MissingNo.
  141: 101, // Electrode
  142: 36,  // Clefable
  143: 110, // Weezing
  144: 53,  // Persian
  145: 105, // Marowak
  // 146: MissingNo.
  147: 93,  // Haunter
  148: 63,  // Abra
  149: 65,  // Alakazam
  150: 17,  // Pidgeotto
  151: 18,  // Pidgeot
  152: 121, // Starmie
  153: 1,   // Bulbasaur
  154: 3,   // Venusaur
  155: 73,  // Tentacruel
  // 156: MissingNo.
  157: 118, // Goldeen
  158: 119, // Seaking
  // 159-162: MissingNo.
  163: 77,  // Ponyta
  164: 78,  // Rapidash
  165: 19,  // Rattata
  166: 20,  // Raticate
  167: 33,  // Nidorino
  168: 30,  // Nidorina
  169: 74,  // Geodude
  170: 137, // Porygon
  171: 142, // Aerodactyl
  // 172: MissingNo.
  173: 81,  // Magnemite
  // 174-175: MissingNo.
  176: 4,   // Charmander
  177: 7,   // Squirtle
  178: 5,   // Charmeleon
  179: 8,   // Wartortle
  180: 6,   // Charizard
  // 181-184: MissingNo.
  185: 43,  // Oddish
  186: 44,  // Gloom
  187: 45,  // Vileplume
  188: 69,  // Bellsprout
  189: 70,  // Weepinbell
  190: 71,  // Victreebel
};