// src/lib/dex/dex.ts
// Small, dependency-free name helpers.
// If you have a more complete dex dataset later, you can swap these maps out without
// touching UI or parsing logic.

import { SPECIES_GEN3 } from "./species";
import { MOVES_GEN3 } from "./moves";
import { ITEMS_GEN3 } from "./items";

export const NATURES: string[] = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

export function natureFromPid(pid: number): { id: number; name: string } {
  const id = ((pid % 25) + 25) % 25; // Ensure positive result
  return { id, name: NATURES[id] ?? `Nature(${id})` };
}

export function speciesName(id: number): string {
  if (!Number.isFinite(id)) return "Unknown";
  return SPECIES_GEN3[id] ?? `Unknown #${id}`;
}

export function moveName(id: number): string {
  if (!Number.isFinite(id) || id === 0) return "(none)";
  return MOVES_GEN3[id] ?? `Move #${id}`;
}

export function itemName(id: number): string {
  if (!Number.isFinite(id) || id === 0) return "(none)";
  return ITEMS_GEN3[id] ?? `Item #${id}`;
}
