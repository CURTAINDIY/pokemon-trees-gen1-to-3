// src/lib/validation/saveValidator.ts
// Enhanced save file validation inspired by PKHeX.Everywhere
// Provides comprehensive integrity checks, checksum validation, and detailed error reporting

import { decodePk3 } from '../gen3/pk3';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  checksumStatus: ChecksumStatus;
  metadata: SaveMetadata;
}

export interface ValidationError {
  type: 'CHECKSUM_MISMATCH' | 'INVALID_SIZE' | 'CORRUPT_DATA' | 'UNSUPPORTED_FORMAT' | 'INVALID_STRUCTURE';
  message: string;
  location?: string;
  severity: 'critical' | 'high' | 'medium';
  fixable: boolean;
}

export interface ValidationWarning {
  type: 'UNUSUAL_DATA' | 'DEPRECATED_FORMAT' | 'EMULATOR_ARTIFACT' | 'MINOR_CORRUPTION';
  message: string;
  location?: string;
}

export interface ChecksumStatus {
  global: boolean;
  sections: { [sectionName: string]: boolean };
  calculated: { [sectionName: string]: number };
  expected: { [sectionName: string]: number };
}

export interface SaveMetadata {
  generation: 1 | 2 | 3;
  game: string;
  region: string;
  playerName: string;
  playerId: number;
  playTime: string;
  emulatorSignature?: string;
  saveCount?: number;
}

/**
 * Comprehensive save file validator that checks integrity, checksums, and structure
 */
export class SaveValidator {
  
  /**
   * Validate a save file with comprehensive checks
   */
  static async validateSave(bytes: Uint8Array, filename: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checksumStatus: { global: true, sections: {}, calculated: {}, expected: {} },
      metadata: {} as SaveMetadata
    };

    // Detect generation and format
    const generation = this.detectGeneration(bytes);
    if (!generation) {
      result.isValid = false;
      result.errors.push({
        type: 'UNSUPPORTED_FORMAT',
        message: 'Unable to detect Pokemon save file format',
        severity: 'critical',
        fixable: false
      });
      return result;
    }

    result.metadata.generation = generation;

    // Perform generation-specific validation
    switch (generation) {
      case 1:
        await this.validateGen1Save(bytes, result);
        break;
      case 2:
        await this.validateGen2Save(bytes, result);
        break;
      case 3:
        await this.validateGen3Save(bytes, result);
        break;
    }

    // Check for emulator artifacts
    this.checkEmulatorArtifacts(bytes, filename, result);

    // Final validation state
    result.isValid = result.errors.filter(e => e.severity === 'critical').length === 0;

    return result;
  }

  /**
   * Detect Pokemon generation from save file structure
   */
  private static detectGeneration(bytes: Uint8Array): 1 | 2 | 3 | null {
    // Gen 3 detection (128KB saves with specific signatures)
    if (bytes.length >= 131072) {
      // Check for GBA save signatures
      if (this.hasGen3Signatures(bytes)) return 3;
    }

    // Gen 1/2 detection (32KB saves)
    if (bytes.length >= 32768) {
      if (this.hasGen1Patterns(bytes)) return 1;
      if (this.hasGen2Patterns(bytes)) return 2;
    }

    return null;
  }

  /**
   * Check for Gen 3 save signatures and structure
   */
  private static hasGen3Signatures(bytes: Uint8Array): boolean {
    // Look for Pokemon game signatures at known locations
    const signatures = [
      'POKEMON ', // Common in RSE/FRLG
      'EMERALD',
      'RUBY',
      'SAPPH',
      'FIRE',
      'LEAF'
    ];

    // Check multiple potential locations for signatures
    const checkPositions = [0x0AC, 0xEAC, 0x1FAC]; // Common signature locations
    
    for (const pos of checkPositions) {
      if (pos + 8 < bytes.length) {
        const segment = Array.from(bytes.slice(pos, pos + 8))
          .map(b => String.fromCharCode(b))
          .join('');
        
        if (signatures.some(sig => segment.includes(sig))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check for Gen 1 save patterns
   */
  private static hasGen1Patterns(bytes: Uint8Array): boolean {
    // Gen 1 has specific patterns at known offsets
    // Check for valid player name at 0x2598
    if (bytes.length >= 0x2598 + 11) {
      const nameBytes = bytes.slice(0x2598, 0x2598 + 11);
      return this.isValidGen1Text(nameBytes);
    }
    return false;
  }

  /**
   * Check for Gen 2 save patterns  
   */
  private static hasGen2Patterns(bytes: Uint8Array): boolean {
    // Gen 2 has different structure than Gen 1
    // Check for valid player name at 0x200B
    if (bytes.length >= 0x200B + 8) {
      const nameBytes = bytes.slice(0x200B, 0x200B + 8);
      return this.isValidGen2Text(nameBytes);
    }
    return false;
  }

  /**
   * Validate Gen 1 text encoding
   */
  private static isValidGen1Text(bytes: Uint8Array): boolean {
    // Gen 1 uses specific character encoding
    // Valid characters are roughly 0x80-0xFF for text, 0x50 for terminator
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b === 0x50) break; // String terminator
      if (b < 0x80 && b !== 0x7F) return false; // Invalid character
    }
    return true;
  }

  /**
   * Validate Gen 2 text encoding
   */
  private static isValidGen2Text(bytes: Uint8Array): boolean {
    // Gen 2 has different text encoding than Gen 1
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b === 0x00) break; // String terminator in Gen 2
      if (b > 0xF4) return false; // Outside valid range
    }
    return true;
  }

  /**
   * Validate Gen 1 save file
   */
  private static async validateGen1Save(bytes: Uint8Array, result: ValidationResult): Promise<void> {
    // Expected size validation
    if (bytes.length !== 32768) {
      result.warnings.push({
        type: 'UNUSUAL_DATA',
        message: `Gen 1 save size is ${bytes.length}, expected 32768`,
        location: 'file_size'
      });
    }

    // Checksum validation for Gen 1
    const mainChecksum = this.calculateGen1Checksum(bytes, 0x2598, 0x26FF);
    const expectedChecksum = this.readUint8(bytes, 0x3594);
    
    result.checksumStatus.calculated['main'] = mainChecksum;
    result.checksumStatus.expected['main'] = expectedChecksum;
    result.checksumStatus.sections['main'] = mainChecksum === expectedChecksum;

    if (mainChecksum !== expectedChecksum) {
      result.errors.push({
        type: 'CHECKSUM_MISMATCH',
        message: `Gen 1 main checksum mismatch`,
        location: 'main_save',
        severity: 'high',
        fixable: true
      });
    }

    // Extract metadata
    try {
      const playerName = this.readGen1Text(bytes, 0x2598, 11);
      result.metadata.playerName = playerName;
      result.metadata.playerId = this.readUint16LE(bytes, 0x2605);
      result.metadata.game = this.detectGen1Game(bytes);
    } catch (e) {
      result.errors.push({
        type: 'CORRUPT_DATA',
        message: `Failed to read Gen 1 metadata: ${e}`,
        location: 'player_data',
        severity: 'medium',
        fixable: false
      });
    }
  }

  /**
   * Validate Gen 2 save file
   */
  private static async validateGen2Save(bytes: Uint8Array, result: ValidationResult): Promise<void> {
    // Similar structure to Gen 1 but different offsets and calculations
    if (bytes.length !== 32768) {
      result.warnings.push({
        type: 'UNUSUAL_DATA',
        message: `Gen 2 save size is ${bytes.length}, expected 32768`,
        location: 'file_size'
      });
    }

    // Gen 2 has multiple save blocks to validate
    const blocks = [
      { start: 0x2009, end: 0x2B82, checksumOffset: 0x2B84 },
      { start: 0x1209, end: 0x1D82, checksumOffset: 0x1D84 }
    ];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const calculated = this.calculateGen2Checksum(bytes, block.start, block.end);
      const expected = this.readUint16LE(bytes, block.checksumOffset);
      
      result.checksumStatus.calculated[`block_${i}`] = calculated;
      result.checksumStatus.expected[`block_${i}`] = expected;
      result.checksumStatus.sections[`block_${i}`] = calculated === expected;

      if (calculated !== expected) {
        result.errors.push({
          type: 'CHECKSUM_MISMATCH',
          message: `Gen 2 block ${i} checksum mismatch`,
          location: `block_${i}`,
          severity: 'high',
          fixable: true
        });
      }
    }
  }

  /**
   * Validate Gen 3 save file with dual-slot verification
   */
  private static async validateGen3Save(bytes: Uint8Array, result: ValidationResult): Promise<void> {
    if (bytes.length !== 131072) {
      result.warnings.push({
        type: 'UNUSUAL_DATA',
        message: `Gen 3 save size is ${bytes.length}, expected 131072`,
        location: 'file_size'
      });
    }

    // Gen 3 has two save slots, we need to check both
    const slot1 = bytes.slice(0, 0x10000);
    const slot2 = bytes.slice(0x10000, 0x20000);

    await this.validateGen3Slot(slot1, 'slot_1', result);
    await this.validateGen3Slot(slot2, 'slot_2', result);

    // Determine which slot is more recent and valid
    const slot1Count = this.readUint32LE(slot1, 0xFFC);
    const slot2Count = this.readUint32LE(slot2, 0xFFC);
    
    result.metadata.saveCount = Math.max(slot1Count, slot2Count);
    
    if (Math.abs(slot1Count - slot2Count) > 1) {
      result.warnings.push({
        type: 'UNUSUAL_DATA',
        message: `Large gap between save counts`,
        location: 'save_counts'
      });
    }
  }

  /**
   * Validate individual Gen 3 save slot
   */
  private static async validateGen3Slot(slotBytes: Uint8Array, slotName: string, result: ValidationResult): Promise<void> {
    // Gen 3 save structure has 14 sections, each 4096 bytes with their own checksums
    for (let section = 0; section < 14; section++) {
      const sectionOffset = section * 0x1000;
      const sectionData = slotBytes.slice(sectionOffset, sectionOffset + 0xFF4); // Data only
      const expectedChecksum = this.readUint32LE(slotBytes, sectionOffset + 0xFF6);
      const calculatedChecksum = this.calculateGen3SectionChecksum(sectionData);

      const sectionKey = `${slotName}_section_${section}`;
      result.checksumStatus.calculated[sectionKey] = calculatedChecksum;
      result.checksumStatus.expected[sectionKey] = expectedChecksum;
      result.checksumStatus.sections[sectionKey] = calculatedChecksum === expectedChecksum;

      if (calculatedChecksum !== expectedChecksum) {
        result.errors.push({
          type: 'CHECKSUM_MISMATCH',
          message: `${slotName} section ${section} checksum mismatch`,
          location: sectionKey,
          severity: 'medium',
          fixable: true
        });
      }
    }
  }

  /**
   * Check for common emulator artifacts and file modifications
   */
  private static checkEmulatorArtifacts(bytes: Uint8Array, _filename: string, result: ValidationResult): void {
    // Check for file size irregularities that indicate emulator artifacts
    const knownSizes = [32768, 131072, 131088, 131104]; // Common save sizes + artifacts
    
    if (!knownSizes.includes(bytes.length)) {
      result.warnings.push({
        type: 'EMULATOR_ARTIFACT',
        message: `Unusual save file size (${bytes.length} bytes)`,
        location: 'file_size'
      });
    }

    // Check for common emulator signatures
    const emulatorSigs = [
      { name: 'VisualBoyAdvance', pattern: [0x56, 0x42, 0x41] },
      { name: 'mGBA', pattern: [0x6D, 0x47, 0x42, 0x41] },
      { name: 'No$GBA', pattern: [0x4E, 0x6F, 0x24, 0x47, 0x42, 0x41] }
    ];

    for (const sig of emulatorSigs) {
      if (this.findPatternInBytes(bytes, sig.pattern)) {
        result.metadata.emulatorSignature = sig.name;
        result.warnings.push({
          type: 'EMULATOR_ARTIFACT',
          message: `Save file contains ${sig.name} emulator signature`,
          location: 'emulator_data'
        });
        break;
      }
    }
  }

  // Utility methods for checksum calculations
  private static calculateGen1Checksum(bytes: Uint8Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i < end && i < bytes.length; i++) {
      sum = (sum + bytes[i]) & 0xFF;
    }
    return (~sum + 1) & 0xFF; // Two's complement
  }

  private static calculateGen2Checksum(bytes: Uint8Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i < end && i < bytes.length; i++) {
      sum = (sum + bytes[i]) & 0xFFFF;
    }
    return sum;
  }

  private static calculateGen3SectionChecksum(sectionData: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < sectionData.length; i += 4) {
      const value = this.readUint32LE(sectionData, i);
      sum = (sum + value) >>> 0; // Unsigned 32-bit addition
    }
    return (sum + (sum >>> 16)) & 0xFFFF; // Fold to 16-bit
  }

  // Utility methods for reading data
  private static readUint8(bytes: Uint8Array, offset: number): number {
    return bytes[offset] || 0;
  }

  private static readUint16LE(bytes: Uint8Array, offset: number): number {
    return (bytes[offset] || 0) | ((bytes[offset + 1] || 0) << 8);
  }

  private static readUint32LE(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] || 0) | 
            ((bytes[offset + 1] || 0) << 8) | 
            ((bytes[offset + 2] || 0) << 16) | 
            ((bytes[offset + 3] || 0) << 24)) >>> 0;
  }

  private static readGen1Text(bytes: Uint8Array, offset: number, maxLength: number): string {
    const chars: string[] = [];
    for (let i = 0; i < maxLength && offset + i < bytes.length; i++) {
      const byte = bytes[offset + i];
      if (byte === 0x50) break; // Terminator
      // Gen 1 character mapping (simplified)
      if (byte >= 0x80 && byte <= 0xF6) {
        chars.push(String.fromCharCode(byte - 0x80 + 0x41)); // Simple A-Z mapping
      }
    }
    return chars.join('');
  }

  private static detectGen1Game(bytes: Uint8Array): string {
    // Simple heuristic based on known patterns
    if (bytes.length >= 0x2000) {
      const region = bytes[0x2000] || 0;
      if (region === 0x01) return 'Red/Blue (International)';
      if (region === 0x02) return 'Yellow (International)';
    }
    return 'Unknown Gen 1 Game';
  }

  private static findPatternInBytes(bytes: Uint8Array, pattern: number[]): boolean {
    for (let i = 0; i <= bytes.length - pattern.length; i++) {
      if (pattern.every((byte, j) => bytes[i + j] === byte)) {
        return true;
      }
    }
    return false;
  }
}

// MOVED OUTSIDE THE CLASS - These are module-level exports
/**
 * Diagnose PK3 shuffle and validity
 */
export function diagnosePk3Shuffle(raw80: Uint8Array): {
  pid: number;
  otId: number;
  permIndex: number;
  checksumStored: number;
  checksumCalculated: number;
  checksumOk: boolean;
  speciesId: number | null;
  interpretation: string;
} {
  const pid = (raw80[0] | (raw80[1] << 8) | (raw80[2] << 16) | (raw80[3] << 24)) >>> 0;
  const otId = (raw80[4] | (raw80[5] << 8) | (raw80[6] << 16) | (raw80[7] << 24)) >>> 0;
  const checksumStored = raw80[0x1C] | (raw80[0x1D] << 8);
  const permIndex = pid % 24;

  console.log('=== PK3 Shuffle Diagnostic ===');
  console.log('PID:', pid.toString(16).padStart(8, '0'));
  console.log('OTID:', otId.toString(16).padStart(8, '0'));
  console.log('Checksum (stored):', checksumStored.toString(16).padStart(4, '0'));
  console.log('Permutation index (pid % 24):', permIndex);

  const decoded = decodePk3(raw80);

  console.log('Checksum (calculated):', decoded.checksumCalculated.toString(16).padStart(4, '0'));
  console.log('Checksum OK:', decoded.checksumOk);
  console.log('Decoded species ID:', decoded.speciesId);
  console.log('Species valid (1-386):', decoded.speciesId !== null && decoded.speciesId >= 1 && decoded.speciesId <= 386);

  let interpretation = 'UNKNOWN';
  if (decoded.checksumOk && decoded.speciesId !== null && decoded.speciesId >= 1 && decoded.speciesId <= 386) {
    interpretation = 'CORRECT - Current unshuffle is working!';
  } else if (!decoded.checksumOk) {
    interpretation = 'WRONG - Checksum mismatch means unshuffle is inverted!';
  } else if (decoded.speciesId === null || decoded.speciesId < 1 || decoded.speciesId > 386) {
    interpretation = 'WRONG - Invalid species means reading wrong bytes!';
  }

  return {
    pid,
    otId,
    permIndex,
    checksumStored,
    checksumCalculated: decoded.checksumCalculated,
    checksumOk: decoded.checksumOk,
    speciesId: decoded.speciesId,
    interpretation
  };
}