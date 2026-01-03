// src/lib/types.ts
// Type definitions for the Pokemon Vault application

export type SaveType = 'gen1' | 'gen2' | 'gen3' | 'unknown';

export interface SaveFile {
  id: string;
  name: string;
  type: SaveType;
  data: Uint8Array;
  addedAt: number;
}

export interface VaultPokemon {
  id: string;
  gen: 1 | 2 | 3;
  speciesId: number;
  level: number;
  sourceFile: string;
  raw: Uint8Array;  // PK3 format (80 bytes)
  addedAt: number;
  selected?: boolean;
}

// Gen 1 Pokemon structure (33 bytes boxed format)
export interface Gen1BoxMon {
  raw33: Uint8Array;
  speciesIndex: number;  // Gen 1 internal index
  natDex: number;        // National Dex number
  otId16: number;
  exp: number;
  level: number;
  moves: [number, number, number, number];
  pps: [number, number, number, number];
  dvs: number;  // 16-bit DVs
}

// Gen 2 Pokemon structure (32 bytes boxed format)
export interface Gen2BoxMon {
  raw32: Uint8Array;
  speciesId: number;  // Gen 2 internal index
  natDex: number;     // National Dex number
  otId16: number;
  exp: number;
  level: number;
  heldItem: number;   // Gen 2 item index
  moves: [number, number, number, number];
  pps: [number, number, number, number];
  dvs: number;  // 16-bit DVs
}

// Gen 3 IVs
export interface IVs {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

// Gen 3 EVs
export interface EVs {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}