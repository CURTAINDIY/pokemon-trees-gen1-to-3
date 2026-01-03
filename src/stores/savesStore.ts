import { googleDrive, DriveFile } from '../services/googleDrive';
import { SaveMetadata } from '../types/vault';

const SAVES_FOLDER_NAME = 'pokemon-vault-saves';
const METADATA_FILE_NAME = 'saves-metadata.json';

class SavesStore {
  private metadataCache: Map<string, SaveMetadata> = new Map();
  private metadataFileId: string | null = null;

  /**
   * Initialize store - load metadata from Drive
   */
  async initialize(): Promise<void> {
    try {
      // Find metadata file
      const files = await googleDrive.findFilesByName(METADATA_FILE_NAME);
      
      if (files.length > 0) {
        this.metadataFileId = files[0].id;
        const content = await googleDrive.downloadFile(this.metadataFileId);
        const text = new TextDecoder().decode(content);
        const metadata: SaveMetadata[] = JSON.parse(text);
        
        metadata.forEach(save => {
          this.metadataCache.set(save.id, save);
        });
      } else {
        // Create initial metadata file
        await this.saveMetadata();
      }
    } catch (error) {
      console.error('Failed to initialize saves store:', error);
      throw error;
    }
  }

  /**
   * Save metadata to Drive
   */
  private async saveMetadata(): Promise<void> {
    const metadata = Array.from(this.metadataCache.values());
    const content = new TextEncoder().encode(JSON.stringify(metadata, null, 2));

    if (this.metadataFileId) {
      await googleDrive.updateFile(this.metadataFileId, content);
    } else {
      const file = await googleDrive.uploadFile(
        METADATA_FILE_NAME,
        content,
        'application/json',
        { type: 'saves-metadata' }
      );
      this.metadataFileId = file.id;
    }
  }

  /**
   * Add new save file
   */
  async addSave(
    id: string,
    name: string,
    filename: string,
    data: Uint8Array,
    metadata: Omit<SaveMetadata, 'id' | 'name' | 'filename' | 'size' | 'uploadedAt' | 'lastModified' | 'driveFileId'>
  ): Promise<SaveMetadata> {
    // Upload save file to Drive
    const file = await googleDrive.uploadFile(
      `${id}.sav`,
      data,
      'application/octet-stream',
      {
        type: 'pokemon-save',
        saveId: id,
        saveName: name,
        generation: metadata.generation?.toString() || '',
      }
    );

    const saveMetadata: SaveMetadata = {
      id,
      name,
      filename,
      size: data.byteLength,
      uploadedAt: Date.now(),
      lastModified: Date.now(),
      driveFileId: file.id,
      ...metadata,
    };

    this.metadataCache.set(id, saveMetadata);
    await this.saveMetadata();

    return saveMetadata;
  }

  /**
   * Get save metadata by ID
   */
  async getSaveMetadata(id: string): Promise<SaveMetadata | null> {
    return this.metadataCache.get(id) || null;
  }

  /**
   * Get save data by ID
   */
  async getSaveData(id: string): Promise<Uint8Array | null> {
    const metadata = this.metadataCache.get(id);
    if (!metadata?.driveFileId) {
      return null;
    }

    try {
      return await googleDrive.downloadFile(metadata.driveFileId);
    } catch (error) {
      console.error('Failed to download save:', error);
      return null;
    }
  }

  /**
   * Get all save metadata
   */
  async getAllSaves(): Promise<SaveMetadata[]> {
    return Array.from(this.metadataCache.values());
  }

  /**
   * Update save metadata
   */
  async updateSaveMetadata(id: string, updates: Partial<SaveMetadata>): Promise<void> {
    const existing = this.metadataCache.get(id);
    if (!existing) {
      throw new Error(`Save not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...updates,
      lastModified: Date.now(),
    };

    this.metadataCache.set(id, updated);
    await this.saveMetadata();

    // Update Drive file metadata if name changed
    if (updates.name && existing.driveFileId) {
      await googleDrive.updateFile(existing.driveFileId, undefined, {
        appProperties: {
          type: 'pokemon-save',
          saveId: id,
          saveName: updates.name,
          generation: updated.generation?.toString() || '',
        },
      });
    }
  }

  /**
   * Delete save
   */
  async deleteSave(id: string): Promise<void> {
    const metadata = this.metadataCache.get(id);
    if (!metadata) {
      return;
    }

    // Delete from Drive
    if (metadata.driveFileId) {
      try {
        await googleDrive.deleteFile(metadata.driveFileId);
      } catch (error) {
        console.error('Failed to delete save file from Drive:', error);
      }
    }

    // Remove from cache
    this.metadataCache.delete(id);
    await this.saveMetadata();
  }

  /**
   * Search saves by criteria
   */
  async searchSaves(criteria: {
    generation?: number;
    game?: string;
    system?: string;
  }): Promise<SaveMetadata[]> {
    const saves = Array.from(this.metadataCache.values());
    
    return saves.filter(save => {
      if (criteria.generation && save.generation !== criteria.generation) {
        return false;
      }
      if (criteria.game && save.game !== criteria.game) {
        return false;
      }
      if (criteria.system && save.system !== criteria.system) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get total storage used by saves
   */
  getTotalSize(): number {
    let total = 0;
    for (const save of this.metadataCache.values()) {
      total += save.size;
    }
    return total;
  }

  /**
   * Clear all local cache (forces reload from Drive)
   */
  clearCache(): void {
    this.metadataCache.clear();
    this.metadataFileId = null;
  }
}

export const savesStore = new SavesStore();
