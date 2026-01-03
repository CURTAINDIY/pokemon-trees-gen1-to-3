// src/lib/dex/expGroups.ts
// PCCS-compliant experience group lookup for proper EXP truncation
// Based on Pokemon Community Conversion Standard

export enum ExpGroup {
  FAST = 0,         // 4L³/5
  MEDIUM_FAST = 1,  // L³
  MEDIUM_SLOW = 2,  // 6L³/5 - 15L² + 100L - 140
  SLOW = 3,         // 5L³/4
}

// Calculate experience points for a given level in each group
export function calculateExpForLevel(group: ExpGroup, level: number): number {
  const l = level;
  const l2 = l * l;
  const l3 = l2 * l;

  switch (group) {
    case ExpGroup.FAST:
      return Math.floor((4 * l3) / 5);

    case ExpGroup.MEDIUM_FAST:
      return l3;

    case ExpGroup.MEDIUM_SLOW: {
      const exp = Math.floor((6 * l3) / 5) - (15 * l2) + (100 * l) - 140;
      return Math.max(0, exp); // Ensure non-negative
    }

    case ExpGroup.SLOW:
      return Math.floor((5 * l3) / 4);

    default:
      return l3; // Default to Medium Fast
  }
}

// Experience group lookup table for species 1-251 (Gen 1-2)
// Based on PCCS pokemon_data tables
export const SPECIES_EXP_GROUP: ExpGroup[] = [
  ExpGroup.MEDIUM_SLOW, // 0 (invalid)
  ExpGroup.MEDIUM_SLOW, // 1 Bulbasaur
  ExpGroup.MEDIUM_SLOW, // 2 Ivysaur
  ExpGroup.MEDIUM_SLOW, // 3 Venusaur
  ExpGroup.MEDIUM_SLOW, // 4 Charmander
  ExpGroup.MEDIUM_SLOW, // 5 Charmeleon
  ExpGroup.MEDIUM_SLOW, // 6 Charizard
  ExpGroup.MEDIUM_SLOW, // 7 Squirtle
  ExpGroup.MEDIUM_SLOW, // 8 Wartortle
  ExpGroup.MEDIUM_SLOW, // 9 Blastoise
  ExpGroup.MEDIUM_FAST,  // 10 Caterpie
  ExpGroup.MEDIUM_FAST,  // 11 Metapod
  ExpGroup.MEDIUM_FAST,  // 12 Butterfree
  ExpGroup.MEDIUM_FAST,  // 13 Weedle
  ExpGroup.MEDIUM_FAST,  // 14 Kakuna
  ExpGroup.MEDIUM_FAST,  // 15 Beedrill
  ExpGroup.MEDIUM_SLOW, // 16 Pidgey
  ExpGroup.MEDIUM_SLOW, // 17 Pidgeotto
  ExpGroup.MEDIUM_SLOW, // 18 Pidgeot
  ExpGroup.MEDIUM_FAST,  // 19 Rattata
  ExpGroup.MEDIUM_FAST,  // 20 Raticate
  ExpGroup.MEDIUM_SLOW, // 21 Spearow
  ExpGroup.MEDIUM_SLOW, // 22 Fearow
  ExpGroup.MEDIUM_FAST,  // 23 Ekans
  ExpGroup.MEDIUM_FAST,  // 24 Arbok
  ExpGroup.MEDIUM_FAST,  // 25 Pikachu
  ExpGroup.MEDIUM_FAST,  // 26 Raichu
  ExpGroup.MEDIUM_FAST,  // 27 Sandshrew
  ExpGroup.MEDIUM_FAST,  // 28 Sandslash
  ExpGroup.MEDIUM_SLOW, // 29 Nidoran♀
  ExpGroup.MEDIUM_SLOW, // 30 Nidorina
  ExpGroup.MEDIUM_SLOW, // 31 Nidoqueen
  ExpGroup.MEDIUM_SLOW, // 32 Nidoran♂
  ExpGroup.MEDIUM_SLOW, // 33 Nidorino
  ExpGroup.MEDIUM_SLOW, // 34 Nidoking
  ExpGroup.FAST,         // 35 Clefairy
  ExpGroup.FAST,         // 36 Clefable
  ExpGroup.FAST,         // 37 Vulpix
  ExpGroup.FAST,         // 38 Ninetales
  ExpGroup.FAST,         // 39 Jigglypuff
  ExpGroup.FAST,         // 40 Wigglytuff
  ExpGroup.MEDIUM_FAST,  // 41 Zubat
  ExpGroup.MEDIUM_FAST,  // 42 Golbat
  ExpGroup.MEDIUM_SLOW, // 43 Oddish
  ExpGroup.MEDIUM_SLOW, // 44 Gloom
  ExpGroup.MEDIUM_SLOW, // 45 Vileplume
  ExpGroup.MEDIUM_FAST,  // 46 Paras
  ExpGroup.MEDIUM_FAST,  // 47 Parasect
  ExpGroup.MEDIUM_FAST,  // 48 Venonat
  ExpGroup.MEDIUM_FAST,  // 49 Venomoth
  ExpGroup.MEDIUM_FAST,  // 50 Diglett
  ExpGroup.MEDIUM_FAST,  // 51 Dugtrio
  ExpGroup.FAST,         // 52 Meowth
  ExpGroup.FAST,         // 53 Persian
  ExpGroup.MEDIUM_FAST,  // 54 Psyduck
  ExpGroup.MEDIUM_FAST,  // 55 Golduck
  ExpGroup.MEDIUM_FAST,  // 56 Mankey
  ExpGroup.MEDIUM_FAST,  // 57 Primeape
  ExpGroup.SLOW,         // 58 Growlithe
  ExpGroup.SLOW,         // 59 Arcanine
  ExpGroup.MEDIUM_SLOW, // 60 Poliwag
  ExpGroup.MEDIUM_SLOW, // 61 Poliwhirl
  ExpGroup.MEDIUM_SLOW, // 62 Poliwrath
  ExpGroup.MEDIUM_SLOW, // 63 Abra
  ExpGroup.MEDIUM_SLOW, // 64 Kadabra
  ExpGroup.MEDIUM_SLOW, // 65 Alakazam
  ExpGroup.MEDIUM_SLOW, // 66 Machop
  ExpGroup.MEDIUM_SLOW, // 67 Machoke
  ExpGroup.MEDIUM_SLOW, // 68 Machamp
  ExpGroup.MEDIUM_SLOW, // 69 Bellsprout
  ExpGroup.MEDIUM_SLOW, // 70 Weepinbell
  ExpGroup.MEDIUM_SLOW, // 71 Victreebel
  ExpGroup.SLOW,         // 72 Tentacool
  ExpGroup.SLOW,         // 73 Tentacruel
  ExpGroup.MEDIUM_SLOW, // 74 Geodude
  ExpGroup.MEDIUM_SLOW, // 75 Graveler
  ExpGroup.MEDIUM_SLOW, // 76 Golem
  ExpGroup.MEDIUM_FAST,  // 77 Ponyta
  ExpGroup.MEDIUM_FAST,  // 78 Rapidash
  ExpGroup.MEDIUM_FAST,  // 79 Slowpoke
  ExpGroup.MEDIUM_FAST,  // 80 Slowbro
  ExpGroup.MEDIUM_FAST,  // 81 Magnemite
  ExpGroup.MEDIUM_FAST,  // 82 Magneton
  ExpGroup.MEDIUM_FAST,  // 83 Farfetch'd
  ExpGroup.MEDIUM_FAST,  // 84 Doduo
  ExpGroup.MEDIUM_FAST,  // 85 Dodrio
  ExpGroup.MEDIUM_FAST,  // 86 Seel
  ExpGroup.MEDIUM_FAST,  // 87 Dewgong
  ExpGroup.MEDIUM_FAST,  // 88 Grimer
  ExpGroup.MEDIUM_FAST,  // 89 Muk
  ExpGroup.SLOW,         // 90 Shellder
  ExpGroup.SLOW,         // 91 Cloyster
  ExpGroup.MEDIUM_FAST,  // 92 Gastly
  ExpGroup.MEDIUM_SLOW, // 93 Haunter
  ExpGroup.MEDIUM_SLOW, // 94 Gengar
  ExpGroup.MEDIUM_FAST,  // 95 Onix
  ExpGroup.MEDIUM_FAST,  // 96 Drowzee
  ExpGroup.MEDIUM_FAST,  // 97 Hypno
  ExpGroup.FAST,         // 98 Krabby
  ExpGroup.FAST,         // 99 Kingler
  ExpGroup.MEDIUM_FAST,  // 100 Voltorb
  ExpGroup.MEDIUM_FAST,  // 101 Electrode
  ExpGroup.SLOW,         // 102 Exeggcute
  ExpGroup.SLOW,         // 103 Exeggutor
  ExpGroup.FAST,         // 104 Cubone
  ExpGroup.FAST,         // 105 Marowak
  ExpGroup.MEDIUM_FAST,  // 106 Hitmonlee
  ExpGroup.MEDIUM_FAST,  // 107 Hitmonchan
  ExpGroup.MEDIUM_FAST,  // 108 Lickitung
  ExpGroup.MEDIUM_FAST,  // 109 Koffing
  ExpGroup.MEDIUM_FAST,  // 110 Weezing
  ExpGroup.MEDIUM_FAST,  // 111 Rhyhorn
  ExpGroup.SLOW,         // 112 Rhydon
  ExpGroup.FAST,         // 113 Chansey
  ExpGroup.MEDIUM_FAST,  // 114 Tangela
  ExpGroup.MEDIUM_FAST,  // 115 Kangaskhan
  ExpGroup.MEDIUM_FAST,  // 116 Horsea
  ExpGroup.MEDIUM_FAST,  // 117 Seadra
  ExpGroup.MEDIUM_FAST,  // 118 Goldeen
  ExpGroup.MEDIUM_FAST,  // 119 Seaking
  ExpGroup.SLOW,         // 120 Staryu
  ExpGroup.SLOW,         // 121 Starmie
  ExpGroup.MEDIUM_FAST,  // 122 Mr. Mime
  ExpGroup.MEDIUM_FAST,  // 123 Scyther
  ExpGroup.MEDIUM_FAST,  // 124 Jynx
  ExpGroup.MEDIUM_FAST,  // 125 Electabuzz
  ExpGroup.MEDIUM_FAST,  // 126 Magmar
  ExpGroup.SLOW,         // 127 Pinsir
  ExpGroup.SLOW,         // 128 Tauros
  ExpGroup.SLOW,         // 129 Magikarp
  ExpGroup.SLOW,         // 130 Gyarados
  ExpGroup.SLOW,         // 131 Lapras
  ExpGroup.MEDIUM_FAST,  // 132 Ditto
  ExpGroup.MEDIUM_FAST,  // 133 Eevee
  ExpGroup.MEDIUM_FAST,  // 134 Vaporeon
  ExpGroup.MEDIUM_FAST,  // 135 Jolteon
  ExpGroup.MEDIUM_FAST,  // 136 Flareon
  ExpGroup.MEDIUM_FAST,  // 137 Porygon
  ExpGroup.MEDIUM_FAST,  // 138 Omanyte
  ExpGroup.MEDIUM_FAST,  // 139 Omastar
  ExpGroup.MEDIUM_FAST,  // 140 Kabuto
  ExpGroup.MEDIUM_FAST,  // 141 Kabutops
  ExpGroup.SLOW,         // 142 Aerodactyl
  ExpGroup.SLOW,         // 143 Snorlax
  ExpGroup.SLOW,         // 144 Articuno
  ExpGroup.SLOW,         // 145 Zapdos
  ExpGroup.SLOW,         // 146 Moltres
  ExpGroup.SLOW,         // 147 Dratini
  ExpGroup.SLOW,         // 148 Dragonair
  ExpGroup.SLOW,         // 149 Dragonite
  ExpGroup.MEDIUM_SLOW, // 150 Mewtwo
  ExpGroup.MEDIUM_SLOW, // 151 Mew
  // Gen 2 species (152-251)
  ExpGroup.MEDIUM_SLOW, // 152 Chikorita
  ExpGroup.MEDIUM_SLOW, // 153 Bayleef
  ExpGroup.MEDIUM_SLOW, // 154 Meganium
  ExpGroup.MEDIUM_SLOW, // 155 Cyndaquil
  ExpGroup.MEDIUM_SLOW, // 156 Quilava
  ExpGroup.MEDIUM_SLOW, // 157 Typhlosion
  ExpGroup.MEDIUM_SLOW, // 158 Totodile
  ExpGroup.MEDIUM_SLOW, // 159 Croconaw
  ExpGroup.MEDIUM_SLOW, // 160 Feraligatr
  ExpGroup.MEDIUM_FAST, // 161 Sentret
  ExpGroup.MEDIUM_FAST, // 162 Furret
  ExpGroup.MEDIUM_SLOW, // 163 Hoothoot
  ExpGroup.MEDIUM_SLOW, // 164 Noctowl
  ExpGroup.MEDIUM_FAST, // 165 Ledyba
  ExpGroup.MEDIUM_FAST, // 166 Ledian
  ExpGroup.FAST, // 167 Spinarak
  ExpGroup.FAST, // 168 Ariados
  ExpGroup.FAST, // 169 Crobat
  ExpGroup.MEDIUM_FAST, // 170 Chinchou
  ExpGroup.MEDIUM_FAST, // 171 Lanturn
  ExpGroup.MEDIUM_FAST, // 172 Pichu
  ExpGroup.FAST, // 173 Cleffa
  ExpGroup.FAST, // 174 Igglybuff
  ExpGroup.FAST, // 175 Togepi
  ExpGroup.FAST, // 176 Togetic
  ExpGroup.MEDIUM_FAST, // 177 Natu
  ExpGroup.MEDIUM_FAST, // 178 Xatu
  ExpGroup.MEDIUM_SLOW, // 179 Mareep
  ExpGroup.MEDIUM_SLOW, // 180 Flaaffy
  ExpGroup.MEDIUM_SLOW, // 181 Ampharos
  ExpGroup.MEDIUM_SLOW, // 182 Bellossom
  ExpGroup.FAST, // 183 Marill
  ExpGroup.FAST, // 184 Azumarill
  ExpGroup.FAST, // 185 Sudowoodo
  ExpGroup.MEDIUM_FAST, // 186 Politoed
  ExpGroup.MEDIUM_FAST, // 187 Hoppip
  ExpGroup.MEDIUM_FAST, // 188 Skiploom
  ExpGroup.MEDIUM_FAST, // 189 Jumpluff
  ExpGroup.MEDIUM_FAST, // 190 Aipom
  ExpGroup.MEDIUM_FAST, // 191 Sunkern
  ExpGroup.MEDIUM_FAST, // 192 Sunflora
  ExpGroup.MEDIUM_FAST, // 193 Yanma
  ExpGroup.MEDIUM_FAST, // 194 Wooper
  ExpGroup.MEDIUM_FAST, // 195 Quagsire
  ExpGroup.MEDIUM_FAST, // 196 Espeon
  ExpGroup.MEDIUM_FAST, // 197 Umbreon
  ExpGroup.MEDIUM_FAST, // 198 Murkrow
  ExpGroup.SLOW, // 199 Slowking
  ExpGroup.MEDIUM_FAST, // 200 Misdreavus
  ExpGroup.MEDIUM_FAST, // 201 Unown
  ExpGroup.FAST, // 202 Wobbuffet
  ExpGroup.SLOW, // 203 Girafarig
  ExpGroup.FAST, // 204 Pineco
  ExpGroup.FAST, // 205 Forretress
  ExpGroup.SLOW, // 206 Dunsparce
  ExpGroup.MEDIUM_FAST, // 207 Gligar
  ExpGroup.MEDIUM_FAST, // 208 Steelix
  ExpGroup.FAST, // 209 Snubbull
  ExpGroup.FAST, // 210 Granbull
  ExpGroup.SLOW, // 211 Qwilfish
  ExpGroup.SLOW, // 212 Scizor
  ExpGroup.FAST, // 213 Shuckle
  ExpGroup.SLOW, // 214 Heracross
  ExpGroup.MEDIUM_FAST, // 215 Sneasel
  ExpGroup.SLOW, // 216 Teddiursa
  ExpGroup.SLOW, // 217 Ursaring
  ExpGroup.MEDIUM_FAST, // 218 Slugma
  ExpGroup.MEDIUM_FAST, // 219 Magcargo
  ExpGroup.SLOW, // 220 Swinub
  ExpGroup.SLOW, // 221 Piloswine
  ExpGroup.MEDIUM_FAST, // 222 Corsola
  ExpGroup.MEDIUM_FAST, // 223 Remoraid
  ExpGroup.MEDIUM_FAST, // 224 Octillery
  ExpGroup.FAST, // 225 Delibird
  ExpGroup.SLOW, // 226 Mantine
  ExpGroup.SLOW, // 227 Skarmory
  ExpGroup.SLOW, // 228 Houndour
  ExpGroup.SLOW, // 229 Houndoom
  ExpGroup.SLOW, // 230 Kingdra
  ExpGroup.MEDIUM_FAST, // 231 Phanpy
  ExpGroup.MEDIUM_FAST, // 232 Donphan
  ExpGroup.MEDIUM_FAST, // 233 Porygon2
  ExpGroup.MEDIUM_FAST, // 234 Stantler
  ExpGroup.FAST, // 235 Smeargle
  ExpGroup.MEDIUM_FAST, // 236 Tyrogue
  ExpGroup.MEDIUM_FAST, // 237 Hitmontop
  ExpGroup.FAST, // 238 Smoochum
  ExpGroup.MEDIUM_FAST, // 239 Elekid
  ExpGroup.MEDIUM_FAST, // 240 Magby
  ExpGroup.SLOW, // 241 Miltank
  ExpGroup.FAST, // 242 Blissey
  ExpGroup.SLOW, // 243 Raikou
  ExpGroup.SLOW, // 244 Entei
  ExpGroup.SLOW, // 245 Suicune
  ExpGroup.SLOW, // 246 Larvitar
  ExpGroup.SLOW, // 247 Pupitar
  ExpGroup.SLOW, // 248 Tyranitar
  ExpGroup.SLOW, // 249 Lugia
  ExpGroup.SLOW, // 250 Ho-Oh
  ExpGroup.MEDIUM_SLOW, // 251 Celebi
];

// Get experience group for a species
export function getExpGroupForSpecies(speciesId: number): ExpGroup {
  if (speciesId < 0 || speciesId >= SPECIES_EXP_GROUP.length) {
    return ExpGroup.MEDIUM_FAST; // Default fallback
  }
  return SPECIES_EXP_GROUP[speciesId];
}

// Get experience for a species at a given level (PCCS ORIGINAL method)
export function getExpForSpeciesLevel(speciesId: number, level: number): number {
  const group = getExpGroupForSpecies(speciesId);
  return calculateExpForLevel(group, level);
}

// Calculate level from experience points (reverse lookup)
export function calculateLevelFromExp(group: ExpGroup, experience: number): number {
  if (experience <= 0) return 1;
  if (experience >= 1000000) return 100; // Cap at level 100
  
  // Binary search for the level
  let low = 1;
  let high = 100;
  
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const expForMid = calculateExpForLevel(group, mid);
    
    if (expForMid <= experience) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  
  return low;
}

// Get level for a species given its experience
export function getLevelForSpeciesExp(speciesId: number, experience: number): number {
  const group = getExpGroupForSpecies(speciesId);
  return calculateLevelFromExp(group, experience);
}
