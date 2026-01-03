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
  createdAt?: number;
}

export interface SavedFileRow {
  id: string;
  filename: string;
  bytes: Uint8Array;
  uploadedAt: number;
  generation?: "gen1" | "gen2" | "gen3";
  gameVersion?: string;
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

  async deleteMon(id: string): Promise<void> {
    monsStore = monsStore.filter(m => m.id !== id);
  },

  async deleteAllMons(): Promise<void> {
    monsStore = [];
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

  async deleteSave(id: string): Promise<void> {
    savesStore = savesStore.filter(s => s.id !== id);
  },

  async deleteAllSaves(): Promise<void> {
    savesStore = [];
  },

  async updateSave(id: string, updates: Partial<SavedFileRow>): Promise<void> {
    const index = savesStore.findIndex(s => s.id === id);
    if (index !== -1) {
      savesStore[index] = { ...savesStore[index], ...updates };
    }
  },
};
