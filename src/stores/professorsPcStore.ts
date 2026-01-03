import { googleDrive } from '../services/googleDrive';
import { VaultPokemon, ProfessorsPcMetadata } from '../types/vault';

const PC_FOLDER_NAME = 'pokemon-vault-pc';
const PC_METADATA_FILE_NAME = 'pc-metadata.json';

class ProfessorsPcStore {
  private pokemonCache: Map<string, VaultPokemon> = new Map();
  private metadataFileId: string | null = null;
  private metadata: ProfessorsPcMetadata = {
    totalPokemon: 0,
    lastModified: Date.now(),
    version: 1,
  };

  /**
   * Initialize store - load Pokemon from Drive
   */
  async initialize(): Promise<void> {
    try {
      // Load metadata
      const metadataFiles = await googleDrive.findFilesByName(PC_METADATA_FILE_NAME);
      
      if (metadataFiles.length > 0) {
        this.metadataFileId = metadataFiles[0].id;
        const content = await googleDrive.downloadFile(this.metadataFileId);
        const text = new TextDecoder().decode(content);
        this.metadata = JSON.parse(text);
      }

      // Load all Pokemon files
      const pokemonFiles = await googleDrive.findFilesByProperty('type', 'pokemon');
      
      for (const file of pokemonFiles) {
        try {
          const content = await googleDrive.downloadFile(file.id);
          const text = new TextDecoder().decode(content);
          const pokemon: VaultPokemon = JSON.parse(text);
          this.pokemonCache.set(pokemon.id, pokemon);
        } catch (error) {
          console.error(`Failed to load Pokemon ${file.id}:`, error);
        }
      }

      // Update metadata count
      this.metadata.totalPokemon = this.pokemonCache.size;
    } catch (error) {
      console.error('Failed to initialize Professor\'s PC store:', error);
      throw error;
    }
  }

  /**
   * Save metadata to Drive
   */
  private async saveMetadata(): Promise<void> {
    const content = new TextEncoder().encode(JSON.stringify(this.metadata, null, 2));

    if (this.metadataFileId) {
      await googleDrive.updateFile(this.metadataFileId, content);
    } else {
      const file = await googleDrive.uploadFile(
        PC_METADATA_FILE_NAME,
        content,
        'application/json',
        { type: 'pc-metadata' }
      );
      this.metadataFileId = file.id;
    }
  }

  /**
   * Add Pokemon to PC
   */
  async addPokemon(pokemon: VaultPokemon): Promise<void> {
    // Serialize Pokemon (excluding pk3 binary for JSON storage)
    const { pk3, ...pokemonData } = pokemon;
    const content = new TextEncoder().encode(JSON.stringify(pokemonData, null, 2));

    // Upload to Drive
    await googleDrive.uploadFile(
      `${pokemon.id}.json`,
      content,
      'application/json',
      {
        type: 'pokemon',
        pokemonId: pokemon.id,
        species: pokemon.natDex.toString(),
        nickname: pokemon.nickname,
        sourceGen: pokemon.sourceGen.toString(),
      }
    );

    // If pk3 data exists, store it separately
    if (pk3) {
      await googleDrive.uploadFile(
        `${pokemon.id}.pk3`,
        pk3,
        'application/octet-stream',
        {
          type: 'pk3-data',
          pokemonId: pokemon.id,
        }
      );
    }

    // Update cache
    this.pokemonCache.set(pokemon.id, pokemon);
    
    // Update metadata
    this.metadata.totalPokemon = this.pokemonCache.size;
    this.metadata.lastModified = Date.now();
    await this.saveMetadata();
  }

  /**
   * Add multiple Pokemon (batch operation)
   */
  async addMultiplePokemon(pokemonList: VaultPokemon[]): Promise<void> {
    // Upload all in parallel for better performance
    await Promise.all(pokemonList.map(p => this.addPokemon(p)));
  }

  /**
   * Get Pokemon by ID
   */
  async getPokemon(id: string): Promise<VaultPokemon | null> {
    return this.pokemonCache.get(id) || null;
  }

  /**
   * Get all Pokemon
   */
  async getAllPokemon(): Promise<VaultPokemon[]> {
    return Array.from(this.pokemonCache.values());
  }

  /**
   * Update Pokemon
   */
  async updatePokemon(id: string, updates: Partial<VaultPokemon>): Promise<void> {
    const existing = this.pokemonCache.get(id);
    if (!existing) {
      throw new Error(`Pokemon not found: ${id}`);
    }

    const updated = { ...existing, ...updates };
    
    // Find the Drive file
    const files = await googleDrive.findFilesByProperty('pokemonId', id);
    const jsonFile = files.find(f => f.name.endsWith('.json'));
    
    if (jsonFile) {
      const { pk3, ...pokemonData } = updated;
      const content = new TextEncoder().encode(JSON.stringify(pokemonData, null, 2));
      await googleDrive.updateFile(jsonFile.id, content);
    }

    // Update pk3 if changed
    if (updates.pk3) {
      const pk3File = files.find(f => f.name.endsWith('.pk3'));
      if (pk3File) {
        await googleDrive.updateFile(pk3File.id, updates.pk3);
      } else {
        await googleDrive.uploadFile(
          `${id}.pk3`,
          updates.pk3,
          'application/octet-stream',
          { type: 'pk3-data', pokemonId: id }
        );
      }
    }

    this.pokemonCache.set(id, updated);
    this.metadata.lastModified = Date.now();
    await this.saveMetadata();
  }

  /**
   * Delete Pokemon
   */
  async deletePokemon(id: string): Promise<void> {
    const pokemon = this.pokemonCache.get(id);
    if (!pokemon) {
      return;
    }

    // Find and delete all related files
    const files = await googleDrive.findFilesByProperty('pokemonId', id);
    await Promise.all(files.map(f => googleDrive.deleteFile(f.id)));

    // Remove from cache
    this.pokemonCache.delete(id);
    
    // Update metadata
    this.metadata.totalPokemon = this.pokemonCache.size;
    this.metadata.lastModified = Date.now();
    await this.saveMetadata();
  }

  /**
   * Delete multiple Pokemon (batch operation)
   */
  async deleteMultiplePokemon(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => this.deletePokemon(id)));
  }

  /**
   * Search Pokemon by criteria
   */
  async searchPokemon(criteria: {
    species?: number;
    natDex?: number;
    sourceGen?: number;
    isShiny?: boolean;
    tags?: string[];
    nickname?: string;
  }): Promise<VaultPokemon[]> {
    const pokemon = Array.from(this.pokemonCache.values());
    
    return pokemon.filter(p => {
      if (criteria.species !== undefined && p.species !== criteria.species) {
        return false;
      }
      if (criteria.natDex !== undefined && p.natDex !== criteria.natDex) {
        return false;
      }
      if (criteria.sourceGen !== undefined && p.sourceGen !== criteria.sourceGen) {
        return false;
      }
      if (criteria.isShiny !== undefined && p.isShiny !== criteria.isShiny) {
        return false;
      }
      if (criteria.nickname && !p.nickname.toLowerCase().includes(criteria.nickname.toLowerCase())) {
        return false;
      }
      if (criteria.tags && criteria.tags.length > 0) {
        if (!p.tags || !criteria.tags.some(tag => p.tags!.includes(tag))) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get Pokemon count by generation
   */
  getCountByGeneration(): { gen1: number; gen2: number; gen3: number } {
    const counts = { gen1: 0, gen2: 0, gen3: 0 };
    
    for (const pokemon of this.pokemonCache.values()) {
      if (pokemon.sourceGen === 1) counts.gen1++;
      else if (pokemon.sourceGen === 2) counts.gen2++;
      else if (pokemon.sourceGen === 3) counts.gen3++;
    }
    
    return counts;
  }

  /**
   * Get PC metadata
   */
  getMetadata(): ProfessorsPcMetadata {
    return { ...this.metadata };
  }

  /**
   * Clear all local cache (forces reload from Drive)
   */
  clearCache(): void {
    this.pokemonCache.clear();
    this.metadataFileId = null;
  }
}

export const professorsPcStore = new ProfessorsPcStore();
