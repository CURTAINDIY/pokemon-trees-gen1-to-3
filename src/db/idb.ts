// src/db/idb.ts
// Stub implementation for pokemon-trees-gen1-to-3 (uses Google Drive instead of IndexedDB)
// This provides the interface expected by stores but doesn't actually store data locally

export interface ProfessorMonRow {
  id: string;
  raw80: Uint8Array;
  fingerprint?: string;
  nickname?: string;
  speciesId?: number;
  level?: number;
  sourceGen?: "gen1" | "gen2" | "gen3";
  saveId?: string;
  saveLabel?: string;
  createdAt: number;
  // Additional properties used by stores
  checksumOk?: boolean;
  pid?: number;
  otName?: string;
  otId?: number;  // Original trainer ID (combined)
  trainerId?: number;  // Lower 16 bits
  secretId?: number;  // Upper 16 bits
  natureName?: string;
  otGender?: number;
  isShiny?: boolean;
  heldItem?: number;
  moves?: number[];
  movePPs?: number[];
  experience?: number;
  metLevel?: number;
  metLocation?: number;
  ballCaughtWith?: number;
  // IVs
  ivHp?: number;
  ivAtk?: number;
  ivDef?: number;
  ivSpa?: number;
  ivSpd?: number;
  ivSpe?: number;
  // EVs
  evHp?: number;
  evAtk?: number;
  evDef?: number;
  evSpa?: number;
  evSpd?: number;
  evSpe?: number;
  // Pokerus and other
  nature?: number;
  pokerus?: number;
  hasPokerus?: boolean;
  hadPokerus?: boolean;
  friendship?: number;
  ability?: number;
  abilityName?: string;
  sourceSaveId?: string;
}

export interface SavedFileRow {
  id: string;
  filename: string;
  bytes: Uint8Array;
  uploadedAt: number;
  generation?: "gen1" | "gen2" | "gen3";
  gameVersion?: string;
  // Additional properties used by stores
  kind: "gen1" | "gen2" | "gen3";  // Required for stores
  createdAt: number;  // Required for stores
  notes?: string;
}

export interface DriveFile {
  id: string;
  name: string;
}

// In-memory storage (will be replaced by Google Drive in actual usage)
let monsStore: ProfessorMonRow[] = [];
let savesStore: SavedFileRow[] = [];

export const idb = {
  // Professor's PC operations
  async listMons(): Promise<ProfessorMonRow[]> {
    return [...monsStore];
  },

  async getMon(id: string): Promise<ProfessorMonRow | undefined> {
    return monsStore.find(m => m.id === id);
  },

  async addMon(mon: ProfessorMonRow): Promise<void> {
    monsStore.push(mon);
  },

  async addMons(mons: ProfessorMonRow[]): Promise<void> {
    monsStore.push(...mons);
  },

  async putMon(mon: ProfessorMonRow): Promise<void> {
    const index = monsStore.findIndex(m => m.id === mon.id);
    if (index !== -1) {
      monsStore[index] = mon;
    } else {
      monsStore.push(mon);
    }
  },

  async deleteMon(id: string): Promise<void> {
    monsStore = monsStore.filter(m => m.id !== id);
  },

  async deleteAllMons(): Promise<void> {
    monsStore = [];
  },

  async clearMons(): Promise<void> {
    monsStore = [];
  },

  async deleteMonsBySourceSaveId(saveId: string): Promise<void> {
    monsStore = monsStore.filter(m => m.sourceSaveId !== saveId);
  },

  async updateMon(id: string, updates: Partial<ProfessorMonRow>): Promise<void> {
    const index = monsStore.findIndex(m => m.id === id);
    if (index !== -1) {
      monsStore[index] = { ...monsStore[index], ...updates };
    }
  },

  // Save Vault operations
  async listSaves(): Promise<SavedFileRow[]> {
    return [...savesStore];
  },

  async getSave(id: string): Promise<SavedFileRow | undefined> {
    return savesStore.find(s => s.id === id);
  },

  async addSave(save: SavedFileRow): Promise<void> {
    savesStore.push(save);
  },

  async putSave(save: SavedFileRow): Promise<void> {
    const index = savesStore.findIndex(s => s.id === save.id);
    if (index !== -1) {
      savesStore[index] = save;
    } else {
      savesStore.push(save);
    }
  },

  async deleteSave(id: string): Promise<void> {
    savesStore = savesStore.filter(s => s.id !== id);
  },

  async deleteAllSaves(): Promise<void> {
    savesStore = [];
  },

  async clearSaves(): Promise<void> {
    savesStore = [];
  },

  async updateSave(id: string, updates: Partial<SavedFileRow>): Promise<void> {
    const index = savesStore.findIndex(s => s.id === id);
    if (index !== -1) {
      savesStore[index] = { ...savesStore[index], ...updates };
    }
  },
};
