// src/lib/gen3/gen3_index_to_natdex.ts
// Gen 3 internal species index → National Dex number mapping
// Based on pokeemerald include/constants/species.h
//
// Gen 3's internal index order:
// 1-251: Kanto/Johto (same as NatDex)
// 252-276: Unown forms (all map to NatDex 201)
// 277-410: Hoenn Pokemon in a SHUFFLED order (NOT sequential!)
// 411: Chimecho (NatDex 358) - placed at end as special case

/**
 * Gen 3 internal index to National Dex mapping for Hoenn Pokemon (277-411)
 * This mapping is NOT a simple offset - Pokemon are shuffled!
 */
const HOENN_INDEX_MAP: [number, number][] = [
  // [internal_index, national_dex]
  [277, 252], // Treecko
  [278, 253], // Grovyle
  [279, 254], // Sceptile
  [280, 255], // Torchic
  [281, 256], // Combusken
  [282, 257], // Blaziken
  [283, 258], // Mudkip
  [284, 259], // Marshtomp
  [285, 260], // Swampert
  [286, 261], // Poochyena
  [287, 262], // Mightyena
  [288, 263], // Zigzagoon
  [289, 264], // Linoone
  [290, 265], // Wurmple
  [291, 266], // Silcoon
  [292, 267], // Beautifly
  [293, 268], // Cascoon
  [294, 269], // Dustox
  [295, 270], // Lotad
  [296, 271], // Lombre
  [297, 272], // Ludicolo
  [298, 273], // Seedot
  [299, 274], // Nuzleaf
  [300, 275], // Shiftry
  [301, 290], // Nincada
  [302, 291], // Ninjask
  [303, 292], // Shedinja
  [304, 276], // Taillow
  [305, 277], // Swellow
  [306, 285], // Shroomish
  [307, 286], // Breloom
  [308, 327], // Spinda
  [309, 278], // Wingull
  [310, 279], // Pelipper
  [311, 283], // Surskit
  [312, 284], // Masquerain
  [313, 320], // Wailmer
  [314, 321], // Wailord
  [315, 300], // Skitty
  [316, 301], // Delcatty
  [317, 352], // Kecleon
  [318, 343], // Baltoy
  [319, 344], // Claydol
  [320, 299], // Nosepass
  [321, 324], // Torkoal
  [322, 302], // Sableye
  [323, 339], // Barboach
  [324, 340], // Whiscash
  [325, 370], // Luvdisc
  [326, 341], // Corphish
  [327, 342], // Crawdaunt
  [328, 349], // Feebas
  [329, 350], // Milotic
  [330, 318], // Carvanha
  [331, 319], // Sharpedo
  [332, 328], // Trapinch
  [333, 329], // Vibrava
  [334, 330], // Flygon
  [335, 296], // Makuhita
  [336, 297], // Hariyama
  [337, 309], // Electrike
  [338, 310], // Manectric
  [339, 322], // Numel
  [340, 323], // Camerupt
  [341, 363], // Spheal
  [342, 364], // Sealeo
  [343, 365], // Walrein
  [344, 331], // Cacnea
  [345, 332], // Cacturne
  [346, 345], // Snorunt
  [347, 346], // Glalie
  [348, 337], // Lunatone
  [349, 338], // Solrock
  [350, 298], // Azurill
  [351, 325], // Spoink
  [352, 326], // Grumpig
  [353, 311], // Plusle
  [354, 312], // Minun
  [355, 303], // Mawile
  [356, 307], // Meditite
  [357, 308], // Medicham
  [358, 333], // Swablu
  [359, 334], // Altaria
  [360, 360], // Wynaut
  [361, 355], // Duskull
  [362, 356], // Dusclops
  [363, 315], // Roselia
  [364, 287], // Slakoth
  [365, 288], // Vigoroth
  [366, 289], // Slaking
  [367, 316], // Gulpin
  [368, 317], // Swalot
  [369, 357], // Tropius
  [370, 293], // Whismur
  [371, 294], // Loudred
  [372, 295], // Exploud
  [373, 366], // Clamperl
  [374, 367], // Huntail
  [375, 368], // Gorebyss
  [376, 359], // Absol
  [377, 353], // Shuppet
  [378, 354], // Banette
  [379, 336], // Seviper
  [380, 335], // Zangoose
  [381, 369], // Relicanth
  [382, 304], // Aron
  [383, 305], // Lairon
  [384, 306], // Aggron
  [385, 351], // Castform
  [386, 313], // Volbeat
  [387, 314], // Illumise
  [388, 345], // Lileep
  [389, 346], // Cradily
  [390, 347], // Anorith
  [391, 348], // Armaldo
  [392, 280], // Ralts
  [393, 281], // Kirlia
  [394, 282], // Gardevoir
  [395, 371], // Bagon
  [396, 372], // Shelgon
  [397, 373], // Salamence
  [398, 374], // Beldum
  [399, 375], // Metang
  [400, 376], // Metagross
  [401, 377], // Regirock
  [402, 378], // Regice
  [403, 379], // Registeel
  [404, 382], // Kyogre
  [405, 383], // Groudon
  [406, 384], // Rayquaza
  [407, 380], // Latias
  [408, 381], // Latios
  [409, 385], // Jirachi
  [410, 386], // Deoxys
  [411, 358], // Chimecho - special case at end!
];

// Build lookup map
const INDEX_TO_NATDEX = new Map<number, number>(HOENN_INDEX_MAP);

export function gen3IndexToNatDex(index: number): number {
  // 0 = empty/egg
  if (index === 0) return 0;
  
  // 1-251: Gen 1-2 Pokemon match National Dex
  if (index >= 1 && index <= 251) return index;
  
  // 252-276: Unown forms → 201
  if (index >= 252 && index <= 276) return 201;
  
  // 277-411: Hoenn Pokemon (use lookup table)
  return INDEX_TO_NATDEX.get(index) ?? index;
}

export function natDexToGen3Index(natDex: number): number {
  if (natDex === 0) return 0;
  if (natDex >= 1 && natDex <= 251) return natDex;
  if (natDex === 201) return 252; // Unown (any form)
  
  // Reverse lookup for Hoenn Pokemon
  for (const [index, nat] of HOENN_INDEX_MAP) {
    if (nat === natDex) return index;
  }
  
  return natDex; // Fallback
}
