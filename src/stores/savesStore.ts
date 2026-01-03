import { idb, type SavedFileRow } from "../db/idb";

// Import helpers from src/lib/...
import { detectGen3Save, GEN3_SAVE_SIZE } from "../lib/gen3/gen3";
import { detectGen1Save, GEN1_SAVE_SIZE } from "../lib/gen1/gen1";
import { detectGen2Save, GEN2_SAVE_SIZE } from "../lib/gen2/gen2";
import { uuid } from "../lib/binary/uuid";

// Enhanced validation system inspired by PKHeX.Everywhere
import { SaveValidator, type ValidationResult } from "../lib/validation/saveValidator";

// Enhanced diagnostic system
import { withDiagnostics, type DiagnosticContext } from "../lib/diagnostics/errorHandler";


export function randomId(prefix: string): string {
  // Use UUID v4 for better uniqueness and collision prevention
  return uuid();
}

export async function readFileAsBytes(file: File): Promise<Uint8Array> {
  const ab = await file.arrayBuffer();
  return new Uint8Array(ab);
}

/**
 * Some emulators append small footers/headers to .sav files (especially Gen 3 GBA).
 * We try to recover the real save payload by slicing to a known valid length.
 */
function normalizeGen3SaveBytes(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length === GEN3_SAVE_SIZE && detectGen3Save(bytes)) return bytes;

  // Most common "extra bytes" case: 128KB save + 16 byte footer.
  if (bytes.length > GEN3_SAVE_SIZE) {
    const head = bytes.slice(0, GEN3_SAVE_SIZE);
    if (detectGen3Save(head)) return head;

    const tail = bytes.slice(bytes.length - GEN3_SAVE_SIZE);
    if (detectGen3Save(tail)) return tail;
  }

  return null;
}

/**
 * Some emulators export 64KB SRAM blobs for GB/GBC games even though the real save is 32KB.
 * If the first 32KB looks valid, use it.
 */
function normalizeGen1Gen2SaveBytes(bytes: Uint8Array): Uint8Array | null {
  // Many emulators produce exactly 32KB (0x8000) for Gen1/2.
  if (bytes.length === GEN1_SAVE_SIZE) return bytes;

  // Some tools append a tiny footer/header (often <= 512 bytes).
  // If trimming down to 32KB yields something detectable, accept it.
  if (bytes.length > GEN1_SAVE_SIZE && bytes.length <= GEN1_SAVE_SIZE + 0x200) {
    console.log(`[Save Normalization] File is ${bytes.length} bytes (${bytes.length - GEN1_SAVE_SIZE} extra bytes)`);
    
    const head = bytes.slice(0, GEN1_SAVE_SIZE);
    // Try both head and tail for validity and choose the one with a higher detection score.
    const tail = bytes.slice(bytes.length - GEN1_SAVE_SIZE);
    const head1 = detectGen1Save(head);
    const head2 = detectGen2Save(head);
    const tail1 = detectGen1Save(tail);
    const tail2 = detectGen2Save(tail);
    
    console.log(`[Save Normalization] Detection results:`, {
      head: { gen1: head1, gen2: head2 },
      tail: { gen1: tail1, gen2: tail2 }
    });
    
    const headScore = (head1 ? 1 : 0) + (head2 ? 1 : 0);
    const tailScore = (tail1 ? 1 : 0) + (tail2 ? 1 : 0);
    
    if (headScore > 0 || tailScore > 0) {
      const selected = headScore >= tailScore ? head : tail;
      console.log(`[Save Normalization] Using ${headScore >= tailScore ? 'head' : 'tail'} (score: ${Math.max(headScore, tailScore)})`);
      return selected;
    }
    
    // Fallback: If neither head nor tail detect, try the head anyway
    // The later validation will provide better error messages
    console.warn(`[Save Normalization] No detection match, defaulting to head slice`);
    return head;
  }

  // Some emulators use 64KB with two 32KB banks/copies; keep the first bank.
  if (bytes.length === 0x10000) {
    const head = bytes.slice(0, GEN1_SAVE_SIZE);
    const tail = bytes.slice(bytes.length - GEN1_SAVE_SIZE);
    const head1 = detectGen1Save(head);
    const head2 = detectGen2Save(head);
    const tail1 = detectGen1Save(tail);
    const tail2 = detectGen2Save(tail);
    // compute combined heuristic scores; we favour whichever half looks more like a valid save
    const headScore = (head1 ? 1 : 0) + (head2 ? 1 : 0);
    const tailScore = (tail1 ? 1 : 0) + (tail2 ? 1 : 0);
    if (headScore > 0 || tailScore > 0) {
      return headScore >= tailScore ? head : tail;
    }
  }

  return null;
}

export const savesStore = {
  async list(): Promise<SavedFileRow[]> {
    return await idb.listSaves();
  },

  buildValidationSummary(validation: ValidationResult): string {
    const parts: string[] = [];
    
    if (validation.metadata.emulatorSignature) {
      parts.push(`Emulator: ${validation.metadata.emulatorSignature}`);
    }
    
    const errorCount = validation.errors.length;
    const warningCount = validation.warnings.length;
    
    if (errorCount > 0 || warningCount > 0) {
      parts.push(`Validation: ${errorCount} errors, ${warningCount} warnings`);
    }
    
    const failedChecksums = Object.entries(validation.checksumStatus.sections)
      .filter(([_, valid]) => !valid).length;
    
    if (failedChecksums > 0) {
      parts.push(`${failedChecksums} checksum mismatches detected`);
    }
    
    return parts.join('. ');
  },

  async importSave(file: File, forcedKind?: SavedFileRow["kind"]): Promise<SavedFileRow> {
    const context: DiagnosticContext = {
      operation: 'importSave',
      filename: file.name,
      fileSize: file.size
    };

    return await withDiagnostics(async () => {
      const raw = await readFileAsBytes(file);

      // --- Normalize bytes (handle emulator footers/headers) FIRST ---
      let bytes: Uint8Array | null = null;
      let kind: SavedFileRow["kind"] | null = forcedKind ?? null;
      let notes: string | undefined;

    if (kind === "gen3") {
      bytes = normalizeGen3SaveBytes(raw);
      if (!bytes) {
        throw new Error(`Not detected as valid Gen3 128KB save. len=${raw.length}`);
      }
    } else if (kind === "gen1" || kind === "gen2") {
      bytes = normalizeGen1Gen2SaveBytes(raw);
      if (!bytes) throw new Error(`Expected 32KB Gen1/2 save (or 64KB padded). len=${raw.length}`);
    } else {
      // Auto-detect
      const gen3 = normalizeGen3SaveBytes(raw);
      if (gen3) {
        bytes = gen3;
        kind = "gen3";
      } else {
        const gb = normalizeGen1Gen2SaveBytes(raw);
        if (!gb) throw new Error(`Unknown/unsupported save file. len=${raw.length}`);
        bytes = gb;

        // Gen1 & Gen2 are both 32KB. Prefer Gen2 when its heuristics match.
        const gen2Det = detectGen2Save(bytes);
        const gen1Det = detectGen1Save(bytes);
        const isGen2 = gen2Det;
        const isGen1 = gen1Det;

        if (isGen1 && !isGen2) {
          kind = "gen1";
        } else if (!isGen1 && isGen2) {
          kind = "gen2";
        } else if (isGen1 && isGen2) {
          // Both detected - prefer Gen2 as it's more specific
          kind = "gen2";
        } else {
          throw new Error(`Unable to detect save generation for 32KB save. Gen1: ${gen1Det ? "ok" : "failed"}. Gen2: ${gen2Det ? "ok" : "failed"}.`);
        }
      }
    }

    if (!bytes || !kind) {
      throw new Error(`Unknown/unsupported save file. len=${raw.length}`);
    }

    // --- Validate the final kind using the normalized payload ---
    if (kind === "gen3") {
      if (bytes.length !== GEN3_SAVE_SIZE || !detectGen3Save(bytes)) {
        throw new Error(`Not detected as valid Gen3 128KB save. len=${bytes.length}`);
      }
    } else if (kind === "gen1") {
      if (bytes.length !== GEN1_SAVE_SIZE || !detectGen1Save(bytes)) {
        throw new Error(`Not detected as valid Gen1 32KB save. len=${bytes.length}`);
      }
    } else if (kind === "gen2") {
      if (bytes.length !== GEN2_SAVE_SIZE || !detectGen2Save(bytes)) {
        throw new Error(`Not detected as valid Gen2 32KB save. len=${bytes.length}`);
      }
    }

    if (raw.length !== bytes.length) {
      notes = `Imported file len=${raw.length}; normalized payload len=${bytes.length}. Your emulator likely added padding/footer bytes.`;
    }

    // Validate the save file
    let validationResult: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checksumStatus: { 
        sections: {},
        global: true,
        calculated: {},
        expected: {}
      },
      metadata: {
        generation: kind === 'gen1' ? 1 : kind === 'gen2' ? 2 : 3,
        game: 'Unknown',
        region: 'Unknown',
        playerName: '',
        playerId: 0,
        playTime: ''
      }
    };
    
    try {
      // Use the static validateSave method instead of instance validate method
      validationResult = await SaveValidator.validateSave(bytes, file.name);
    } catch (e) {
      console.warn('Validation failed:', e);
    }

    // Add validation information to notes
    const validationSummary = this.buildValidationSummary(validationResult);
    if (validationSummary) {
      notes = notes ? `${notes} ${validationSummary}` : validationSummary;
    }

    const row: SavedFileRow = {
      id: randomId("sav"),
      filename: file.name,
      createdAt: Date.now(),
      bytes,
      kind,
      notes,
    };

      await idb.putSave(row);
      return row;
    }, context);
  },

  async importGen3Save(file: File): Promise<SavedFileRow> {
    return await this.importSave(file, "gen3");
  },

  async delete(id: string): Promise<void> {
    // Delete the save row
    await idb.deleteSave(id);

    // Also delete any Professor's PC entries that were imported from this save
    try {
      await idb.deleteMonsBySourceSaveId(id);
    } catch {
      // ignore (older DB schema)
    }
  },

  async clearAll(): Promise<void> {
    await idb.clearSaves();
  },
};