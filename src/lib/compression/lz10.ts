// src/lib/compression/lz10.ts
// LZ10 compression implementation inspired by Poke Transporter GB
// Provides efficient compression for save files in IndexedDB storage

export interface CompressionResult {
  compressed: Uint8Array;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface DecompressionResult {
  decompressed: Uint8Array;
  originalSize: number;
}

/**
 * LZ10 compression implementation optimized for Pokemon save files
 * Based on the LZ10 standard used in various Nintendo formats
 */
export class LZ10Compressor {
  
  /**
   * Compress data using LZ10 algorithm
   */
  static compress(input: Uint8Array): CompressionResult {
    if (input.length === 0) {
      return {
        compressed: new Uint8Array([0x10, 0, 0, 0]), // LZ10 header for empty data
        originalSize: 0,
        compressedSize: 4,
        compressionRatio: 1
      };
    }

    const output: number[] = [];
    let inputPos = 0;

    // LZ10 header: 0x10 followed by 24-bit little-endian uncompressed size
    output.push(0x10);
    output.push(input.length & 0xFF);
    output.push((input.length >> 8) & 0xFF);
    output.push((input.length >> 16) & 0xFF);

    while (inputPos < input.length) {
      const flagByte = this.compressBlock(input, inputPos, output);
      inputPos += flagByte.bytesConsumed;
    }

    const compressed = new Uint8Array(output);
    const compressionRatio = input.length / compressed.length;

    return {
      compressed,
      originalSize: input.length,
      compressedSize: compressed.length,
      compressionRatio
    };
  }

  /**
   * Decompress LZ10 compressed data
   */
  static decompress(compressed: Uint8Array): DecompressionResult {
    if (compressed.length < 4) {
      throw new Error('LZ10: Compressed data too short (missing header)');
    }

    // Check LZ10 signature
    if (compressed[0] !== 0x10) {
      throw new Error(`LZ10: Invalid signature 0x${compressed[0].toString(16)}, expected 0x10`);
    }

    // Read uncompressed size (24-bit little-endian)
    const originalSize = compressed[1] | (compressed[2] << 8) | (compressed[3] << 16);
    if (originalSize === 0) {
      return {
        decompressed: new Uint8Array(0),
        originalSize: 0
      };
    }

    const output = new Uint8Array(originalSize);
    let inputPos = 4; // Skip header
    let outputPos = 0;

    while (inputPos < compressed.length && outputPos < originalSize) {
      const flagByte = compressed[inputPos++];
      
      for (let i = 0; i < 8 && inputPos < compressed.length && outputPos < originalSize; i++) {
        if (flagByte & (1 << (7 - i))) {
          // Compressed data (back-reference)
          if (inputPos + 1 >= compressed.length) break;
          
          const byte1 = compressed[inputPos++];
          const byte2 = compressed[inputPos++];
          
          const length = ((byte1 >> 4) & 0x0F) + 3;
          const offset = ((byte1 & 0x0F) << 8) | byte2;
          
          if (offset === 0) {
            throw new Error('LZ10: Invalid offset 0 in back-reference');
          }
          
          const backPos = outputPos - offset;
          if (backPos < 0) {
            throw new Error(`LZ10: Back-reference before start of data (pos=${outputPos}, offset=${offset})`);
          }
          
          // Copy with potential overlap handling
          for (let j = 0; j < length && outputPos < originalSize; j++) {
            const sourcePos = backPos + j;
            if (sourcePos >= outputPos) {
              // Handle overlapping copy case
              output[outputPos++] = output[backPos + (j % offset)];
            } else {
              output[outputPos++] = output[sourcePos];
            }
          }
        } else {
          // Literal byte
          if (inputPos < compressed.length && outputPos < originalSize) {
            output[outputPos++] = compressed[inputPos++];
          }
        }
      }
    }

    if (outputPos !== originalSize) {
      console.warn(`LZ10: Decompressed size mismatch: got ${outputPos}, expected ${originalSize}`);
    }

    return {
      decompressed: output,
      originalSize
    };
  }

  /**
   * Check if data appears to be LZ10 compressed
   */
  static isLZ10Compressed(data: Uint8Array): boolean {
    return data.length >= 4 && data[0] === 0x10;
  }

  /**
   * Compress a single block of data (up to 8 operations)
   */
  private static compressBlock(input: Uint8Array, startPos: number, output: number[]): { bytesConsumed: number } {
    const flagBytePos = output.length;
    output.push(0); // Placeholder for flag byte
    
    let flagByte = 0;
    let bytesConsumed = 0;
    
    for (let i = 0; i < 8 && startPos + bytesConsumed < input.length; i++) {
      const currentPos = startPos + bytesConsumed;
      const match = this.findLongestMatch(input, currentPos);
      
      if (match && match.length >= 3) {
        // Use compression
        flagByte |= (1 << (7 - i));
        
        const lengthCode = Math.min(match.length - 3, 15);
        const offsetCode = match.offset;
        
        const byte1 = (lengthCode << 4) | ((offsetCode >> 8) & 0x0F);
        const byte2 = offsetCode & 0xFF;
        
        output.push(byte1);
        output.push(byte2);
        
        bytesConsumed += match.length;
      } else {
        // Use literal
        output.push(input[currentPos]);
        bytesConsumed++;
      }
    }
    
    output[flagBytePos] = flagByte;
    return { bytesConsumed };
  }

  /**
   * Find the longest matching sequence for LZ10 compression
   */
  private static findLongestMatch(input: Uint8Array, currentPos: number): { offset: number; length: number } | null {
    const maxOffset = Math.min(currentPos, 0xFFF); // 12-bit offset limit
    const maxLength = Math.min(18, input.length - currentPos); // 4-bit length + 3
    
    let bestMatch: { offset: number; length: number } | null = null;
    
    // Search backwards for matches
    for (let offset = 1; offset <= maxOffset; offset++) {
      const backPos = currentPos - offset;
      if (backPos < 0) break;
      
      let length = 0;
      while (length < maxLength && 
             currentPos + length < input.length &&
             input[backPos + (length % offset)] === input[currentPos + length]) {
        length++;
      }
      
      if (length >= 3 && (!bestMatch || length > bestMatch.length)) {
        bestMatch = { offset, length };
      }
    }
    
    return bestMatch;
  }

  /**
   * Estimate compression ratio without actually compressing
   * Useful for deciding whether compression is worthwhile
   */
  static estimateCompressionRatio(input: Uint8Array): number {
    if (input.length === 0) return 1;

    let compressibleBytes = 0;
    let totalBytes = input.length;

    // Sample every 100 bytes for estimation
    for (let i = 0; i < input.length; i += 100) {
      const match = this.findLongestMatch(input, i);
      if (match && match.length >= 3) {
        compressibleBytes += match.length;
      }
    }

    // Rough estimation: compressed sections save ~50% space on average
    const estimatedSavings = compressibleBytes * 0.5;
    const estimatedCompressedSize = totalBytes - estimatedSavings + 4; // +4 for header
    
    return Math.max(0.1, totalBytes / estimatedCompressedSize);
  }
}

/**
 * Helper functions for working with compressed save files
 */
export class SaveCompression {
  
  /**
   * Compress a save file if beneficial
   */
  static async compressSave(saveData: Uint8Array): Promise<{ data: Uint8Array; compressed: boolean; stats?: CompressionResult }> {
    // Don't compress small files or files that won't benefit significantly
    if (saveData.length < 64 * 1024) {
      return { data: saveData, compressed: false };
    }
    
    // Quick estimation to avoid compressing data that won't benefit
    const estimatedRatio = LZ10Compressor.estimateCompressionRatio(saveData);
    
    if (estimatedRatio < 1.3) {
      // Not worth compressing
      return { data: saveData, compressed: false };
    }

    try {
      const result = LZ10Compressor.compress(saveData);
      
      // Only use compression if we achieve significant space savings
      if (result.compressionRatio > 1.2) {
        console.log(`💾 LZ10 compression: ${result.originalSize} → ${result.compressedSize} bytes (${(result.compressionRatio * 100 - 100).toFixed(1)}% reduction)`);
        return { data: result.compressed, compressed: true, stats: result };
      } else {
        return { data: saveData, compressed: false };
      }
    } catch (error) {
      console.warn('LZ10 compression failed:', error);
      return { data: saveData, compressed: false };
    }
  }

  /**
   * Decompress save file if it's compressed
   */
  static async decompressSave(data: Uint8Array): Promise<Uint8Array> {
    if (!LZ10Compressor.isLZ10Compressed(data)) {
      return data; // Not compressed
    }

    try {
      const result = LZ10Compressor.decompress(data);
      console.log(`📦 LZ10 decompression: ${data.length} → ${result.originalSize} bytes`);
      return result.decompressed;
    } catch (error) {
      console.error('LZ10 decompression failed:', error);
      throw new Error(`Failed to decompress save data: ${error}`);
    }
  }
}