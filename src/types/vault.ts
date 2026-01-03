export interface VaultPokemon {
  id: string; // UUID
  species: number;
  natDex: number;
  nickname: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  ot: string;
  otId: number;
  otSid?: number;
  moves: number[];
  pid: number;
  ivs: number[];
  evs: number[];
  nature?: string;
  ability?: number;
  heldItem?: number;
  metLevel?: number;
  metLocation?: number;
  pokeball?: number;
  isEgg?: boolean;
  isShiny?: boolean;
  pokerus?: number;
  ribbons?: number[];
  sourceGen: 1 | 2 | 3;
  sourceGame?: string;
  originalFormat?: 'gen1' | 'gen2' | 'pk3';
  pk3?: Uint8Array; // The actual PK3 data
  importedAt: number; // timestamp
  tags?: string[]; // User-defined tags
}

export interface SaveMetadata {
  id: string; // UUID
  name: string; // User-provided name
  filename: string; // Original filename
  size: number;
  system: 'GB/GBC' | 'GBA' | 'NDS' | 'Unknown';
  generation: 1 | 2 | 3 | null;
  game?: string;
  fingerprint: string; // SHA-256 or FNV hash
  uploadedAt: number;
  lastModified: number;
  driveFileId?: string; // Google Drive file ID
}

export interface ProfessorsPcMetadata {
  totalPokemon: number;
  lastModified: number;
  version: number; // Schema version
}
