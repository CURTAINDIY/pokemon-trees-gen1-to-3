// src/lib/gen3/pk3LanguageFix.ts
// Fix invalid language codes in PK3 data that cause Bad Eggs

function readU16LE(b: Uint8Array, off: number): number {
  return (b[off] | (b[off + 1] << 8)) >>> 0;
}

function writeU16LE(b: Uint8Array, off: number, v: number) {
  b[off] = v & 0xff;
  b[off + 1] = (v >>> 8) & 0xff;
}

/**
 * Valid Gen 3 language codes
 */
const VALID_GEN3_LANGUAGES = {
  JAPANESE: 0x0201,
  ENGLISH: 0x0202,
  FRENCH: 0x0203,
  ITALIAN: 0x0204,
  GERMAN: 0x0205,
  SPANISH: 0x0206,
  KOREAN: 0x0207,
} as const;

/**
 * Fix invalid language code in PK3 data
 * Language is stored at offset 0x12-0x13
 * 
 * @param raw80 The 80-byte PK3 data (will be modified in place)
 * @param targetLanguage Target language code (default: English 0x0202)
 * @returns true if language was fixed, false if already valid
 */
export function fixPk3Language(
  raw80: Uint8Array,
  targetLanguage: number = VALID_GEN3_LANGUAGES.ENGLISH
): boolean {
  if (raw80.length !== 80) {
    console.error(`Invalid PK3 size: ${raw80.length} bytes (expected 80)`);
    return false;
  }

  const currentLanguage = readU16LE(raw80, 0x12);
  const validLanguages = Object.values(VALID_GEN3_LANGUAGES) as number[];

  // Check if current language is valid
  if (validLanguages.includes(currentLanguage)) {
    console.log(`✅ Language already valid: 0x${currentLanguage.toString(16).padStart(4, '0')}`);
    return false;
  }

  // Fix the language
  console.log(`🔧 Fixing language: 0x${currentLanguage.toString(16).padStart(4, '0')} → 0x${targetLanguage.toString(16).padStart(4, '0')}`);
  writeU16LE(raw80, 0x12, targetLanguage);

  return true;
}

/**
 * Batch fix language codes for multiple Pokemon
 * @param raw80Array Array of 80-byte PK3 data (will be modified in place)
 * @param targetLanguage Target language code (default: English)
 * @returns Number of Pokemon with fixed languages
 */
export function fixPk3LanguageBatch(
  raw80Array: Uint8Array[],
  targetLanguage: number = VALID_GEN3_LANGUAGES.ENGLISH
): number {
  let fixed = 0;
  for (const raw80 of raw80Array) {
    if (fixPk3Language(raw80, targetLanguage)) {
      fixed++;
    }
  }
  return fixed;
}

/**
 * Check if a PK3's language code is valid
 */
export function isPk3LanguageValid(raw80: Uint8Array): boolean {
  if (raw80.length !== 80) return false;
  const language = readU16LE(raw80, 0x12);
  const validLanguages = Object.values(VALID_GEN3_LANGUAGES) as number[];
  return validLanguages.includes(language);
}

/**
 * Get the language code from PK3 data
 */
export function getPk3Language(raw80: Uint8Array): number | null {
  if (raw80.length !== 80) return null;
  return readU16LE(raw80, 0x12);
}

/**
 * Get human-readable language name
 */
export function getLanguageName(languageCode: number): string {
  switch (languageCode) {
    case VALID_GEN3_LANGUAGES.JAPANESE: return 'Japanese';
    case VALID_GEN3_LANGUAGES.ENGLISH: return 'English';
    case VALID_GEN3_LANGUAGES.FRENCH: return 'French';
    case VALID_GEN3_LANGUAGES.ITALIAN: return 'Italian';
    case VALID_GEN3_LANGUAGES.GERMAN: return 'German';
    case VALID_GEN3_LANGUAGES.SPANISH: return 'Spanish';
    case VALID_GEN3_LANGUAGES.KOREAN: return 'Korean';
    default: return `Unknown (0x${languageCode.toString(16).padStart(4, '0')})`;
  }
}
