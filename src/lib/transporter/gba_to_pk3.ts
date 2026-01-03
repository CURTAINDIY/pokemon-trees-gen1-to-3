// src/lib/transporter/gba_to_pk3.ts
//
// Gen3 boxed Pokémon in PC storage are already PK3 (80 bytes).
// So "converting" a Gen3 box mon to PK3 means returning raw80.

const PK3_SIZE = 80;

export function isValidPk3(raw80: Uint8Array): boolean {
  return raw80 instanceof Uint8Array && raw80.length === PK3_SIZE;
}

/**
 * Convert a Gen3 boxed mon (already PK3) into the raw 80-byte PK3 blob.
 *
 * Accepts Uint8Array (already raw80)
 */
export function convertGen3BoxMonToPk3(mon: Uint8Array): Uint8Array {
  if (!isValidPk3(mon)) throw new Error(`Expected PK3 raw80 (len=${PK3_SIZE}); got len=${mon.length}`);
  return mon;
}
