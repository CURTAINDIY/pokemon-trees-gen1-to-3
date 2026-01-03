// src/components/ProfessorsPc.tsx

import { useEffect, useMemo, useState } from "react";
import type { ProfessorMonRow } from "../db/idb";
import { idb } from "../db/idb";
import { decodePk3 } from "../lib/gen3/pk3";
import { speciesName } from "../lib/dex/dex";
import { MOVES_GEN3 } from "../lib/dex/moves";
import { ITEMS_GEN3 } from "../lib/dex/items";
import { deleteAllProfessorMons, deleteSelectedMons, importSaveToProfessorPc, repairProfessorMonMetadata, repairBadEggIssues } from "../stores/professorsPcStore";

function displayNameForRow(row: ProfessorMonRow): { 
  displayName: string; 
  displaySpecies: string;
  warn: boolean; 
  checksumOk: boolean;
} {
  // ALWAYS re-decode from raw80 to ensure we use the fixed decoder
  const d = decodePk3(row.raw80);
  const checksumOk = !!d.checksumOk;
  const nick = d.nickname.trim();
  const speciesId = d.speciesId; // Use fresh decode, not cached row.speciesId

  // Debug log for mismatches
  if (typeof window !== 'undefined' && row.speciesId && row.speciesId !== speciesId) {
    console.warn(`[Display] Species mismatch for ${nick}:`, {
      cachedSpecies: row.speciesId,
      freshDecodeSpecies: speciesId,
      nickname: nick,
      pid: d.pid
    });
  }

  // Show species name ONLY if checksum OK and valid range
  const showSpecies = checksumOk && speciesId != null && speciesId >= 1 && speciesId <= 386;

  const displayName = nick.length 
    ? nick 
    : showSpecies 
      ? speciesName(speciesId!) 
      : "???";
  
  const displaySpecies = showSpecies ? speciesName(speciesId!) : "—";
  
  return { 
    displayName, 
    displaySpecies,
    warn: !showSpecies, 
    checksumOk 
  };
}

function getMoveName(moveId: number | undefined): string {
  if (!moveId || moveId === 0) return "—";
  return MOVES_GEN3[moveId] || `Move ${moveId}`;
}

function getItemName(itemId: number | undefined): string {
  if (!itemId || itemId === 0) return "—";
  return ITEMS_GEN3[itemId] || `Item ${itemId}`;
}

/* Unused helper functions - kept for future use
function formatIVs(row: ProfessorMonRow): string {
  if (!row.checksumOk) return "—";
  const ivs = [row.ivHp, row.ivAtk, row.ivDef, row.ivSpa, row.ivSpd, row.ivSpe];
  if (ivs.some(v => v === undefined)) return "—";
  return ivs.join("/");
}

function calculateDisplayLevel(row: ProfessorMonRow): number {
  // Calculate actual level from experience for display
  if (!row.checksumOk || !row.experience || !row.speciesId) {
    return row.level ?? row.metLevel ?? 0;
  }
  
  try {
    return getLevelForSpeciesExp(row.speciesId, row.experience);
  } catch {
    return row.level ?? row.metLevel ?? 0;
  }
}
*/

function formatPokerus(row: ProfessorMonRow): string {
  if (!row.checksumOk) return "—";
  if (row.hasPokerus) return "🦠 Active";
  if (row.hadPokerus) return "✓ Cured";
  return "—";
}

interface ProfessorsPcProps {
  selectedMonIds: string[];
  onSelectMonIds: (ids: string[]) => void;
}

export default function ProfessorsPc({ selectedMonIds, onSelectMonIds }: ProfessorsPcProps) {
  const [mons, setMons] = useState<ProfessorMonRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [showChecksumFailedOnly, setShowChecksumFailedOnly] = useState(false);
  const [showShinyOnly, setShowShinyOnly] = useState(false);
  const [showPokerusOnly, setShowPokerusOnly] = useState(false);
  const [selectAllToggle, setSelectAllToggle] = useState(false);

  async function refresh() {
    const rows = await idb.listMons();
    // newest first
    rows.sort((a, b) => b.createdAt - a.createdAt);
    setMons(rows);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const view = useMemo(() => {
    let filtered = mons;
    
    // Sort by National Dex number (speciesId), then by creation time
    filtered = filtered.sort((a, b) => {
      const aSpecies = a.speciesId || 9999;
      const bSpecies = b.speciesId || 9999;
      
      if (aSpecies !== bSpecies) {
        return aSpecies - bSpecies; // Sort by National Dex
      }
      
      return b.createdAt - a.createdAt; // If same species, newest first
    });
    
    // Add display info first so we can filter by warn flag
    const withDisplay = filtered.map((m) => {
      const disp = displayNameForRow(m);
      return { ...m, disp };
    });
    
    let result = withDisplay;
    
    // Apply checksum failed filter if enabled (filter by warn flag which includes checksum + species validation)
    if (showChecksumFailedOnly) {
      result = result.filter(m => m.disp.warn);
    }
    
    // Apply Shiny filter if enabled
    if (showShinyOnly) {
      result = result.filter(m => m.isShiny);
    }
    
    // Apply Pokerus filter if enabled
    if (showPokerusOnly) {
      result = result.filter(m => m.hasPokerus || m.hadPokerus);
    }
    
    return result;
  }, [mons, showChecksumFailedOnly, showShinyOnly, showPokerusOnly]);

  async function onImportSave(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());

    setBusy(true);
    setStatus("");
    try {
      const stats = await importSaveToProfessorPc(bytes, f.name);
      setStatus(`Imported ${stats.added} mons (seen=${stats.totalSeen}, duplicates=${stats.skippedDuplicates}).`);
      await refresh();
    } catch (err: any) {
      setStatus(`Import failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onDeleteAll() {
    if (!confirm("Delete ALL Pokémon from Professor's PC?")) return;
    setBusy(true);
    setStatus("");
    try {
      await deleteAllProfessorMons();
      setStatus("Deleted all Professor's PC mons.");
      onSelectMonIds([]);
      await refresh();
    } catch (err: any) {
      setStatus(`Delete failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSelected() {
    if (selectedMonIds.length === 0) {
      setStatus("No Pokémon selected.");
      return;
    }
    if (!confirm(`Delete ${selectedMonIds.length} selected Pokémon?`)) return;
    setBusy(true);
    setStatus("");
    try {
      await deleteSelectedMons(selectedMonIds);
      setStatus(`Deleted ${selectedMonIds.length} selected Pokémon.`);
      onSelectMonIds([]);
      await refresh();
    } catch (err: any) {
      setStatus(`Delete failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onRepair() {
    setBusy(true);
    setStatus("");
    try {
      console.log("\n========================================");
      console.log("REPAIRING PROFESSOR'S PC METADATA");
      console.log("========================================");
      console.log(`Processing ${mons.length} Pokémon...`);
      
      await repairProfessorMonMetadata();
      
      console.log("✅ Metadata repair complete");
      console.log("========================================\n");
      
      setStatus(`✅ Repaired cached metadata for ${mons.length} Pokémon (species, moves, stats, fingerprints).`);
      await refresh();
    } catch (err: any) {
      setStatus(`Repair failed: ${err?.message ?? String(err)}`);
      console.error("Repair metadata error:", err);
    } finally {
      setBusy(false);
    }
  }

  async function onFixChecksumAndBadEgg() {
    if (selectedMonIds.length === 0) {
      setStatus("No Pokémon selected. Select Pokemon to fix checksums and Bad Egg issues.");
      return;
    }
    if (!confirm(`Fix checksums and Bad Egg issues for ${selectedMonIds.length} selected Pokémon?\n\nThis will repair:\n- Checksums\n- Invalid language codes\n- Met Level mismatches\n- Egg bit flags`)) return;
    
    setBusy(true);
    setStatus("");
    try {
      const result = await repairBadEggIssues(selectedMonIds);
      setStatus(`✅ Fixed ${result.repaired} Pokemon (${result.languageFixed} language, ${result.metLevelFixed} met level, ${result.eggBitFixed} egg bit, ${result.checksumFixed} checksum). Failed: ${result.failed}`);
      onSelectMonIds([]);
      await refresh();
    } catch (err: any) {
      setStatus(`Fix failed: ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function onToggleSelectAll(checked: boolean) {
    setSelectAllToggle(checked);
    if (checked) {
      // Select all visible rows
      onSelectMonIds(view.map(m => m.id));
    } else {
      // Deselect all
      onSelectMonIds([]);
    }
  }

  async function onRemoveDuplicates() {
    if (!confirm(`Scan for and remove duplicate Pokémon?\n\nThis will detect duplicates based on visible data:\n• Species, Nickname, Level/Experience\n• Moves, Nature, OT Name/ID\n• Shiny and Pokérus status\n\nPokémon from different save files with matching data will be considered duplicates.\nKeeps the first occurrence, deletes the rest.`)) return;
    
    setBusy(true);
    setStatus("");
    try {
      console.log("\n========================================");
      console.log("SCANNING FOR DUPLICATE POKÉMON (Smart Detection)");
      console.log("========================================");
      console.log(`Total Pokémon: ${mons.length}`);
      
      // Build smart fingerprint map based on visible attributes
      const fingerprintMap = new Map<string, string[]>();
      
      for (const mon of mons) {
        // Create fingerprint from visible data that users can see
        const visibleData = {
          species: mon.speciesId,
          nickname: mon.nickname || '',
          exp: mon.experience,
          moves: (mon.moves || []).sort().join(','), // Sort to handle move order differences
          nature: mon.nature,
          otName: mon.otName || '',
          otId: mon.otId,
          isShiny: mon.isShiny || false,
          hasPokerus: mon.hasPokerus || false,
          hadPokerus: mon.hadPokerus || false,
          heldItem: mon.heldItem || 0
        };
        
        // Create a stable string representation
        const fp = JSON.stringify(visibleData);
        
        if (!fingerprintMap.has(fp)) {
          fingerprintMap.set(fp, []);
        }
        fingerprintMap.get(fp)!.push(mon.id);
      }
      
      console.log(`Unique Pokémon (by visible data): ${fingerprintMap.size}`);
      console.log(`Using smart detection: Species + Nickname + Exp + Moves + Nature + OT + Status`);
      
      // Find duplicates (keep first, delete rest)
      const toDelete: string[] = [];
      let duplicateGroups = 0;
      for (const [_fp, ids] of fingerprintMap.entries()) {
        if (ids.length > 1) {
          duplicateGroups++;
          // Keep first, delete rest
          toDelete.push(...ids.slice(1));
          
          // Log first pokemon in group for context
          const firstMon = mons.find(m => m.id === ids[0]);
          const dupCount = ids.length - 1;
          const nickname = firstMon?.nickname || speciesName(firstMon?.speciesId || 0);
          console.log(`Duplicate group #${duplicateGroups}: ${nickname} (${firstMon?.otName || '???'}) - ${dupCount} duplicate(s)`);
          console.log(`  Keeping: ${ids[0]} (created: ${new Date(firstMon?.createdAt || 0).toLocaleString()})`);
          console.log(`  Deleting: ${ids.slice(1).join(', ')}`);
        }
      }
      
      if (toDelete.length === 0) {
        console.log("✅ No duplicates found.");
        console.log("\nAll Pokémon have unique combinations of species, nickname, experience, moves, nature, and OT.");
        setStatus("✅ No duplicates found. All Pokémon are unique!");
        setBusy(false);
        return;
      }
      
      console.log(`\nDeleting ${toDelete.length} duplicates from ${duplicateGroups} groups`);
      console.log("Note: These Pokémon matched on all visible attributes (likely from duplicate save imports)");
      console.log("========================================\n");
      
      await deleteSelectedMons(toDelete);
      setStatus(`✅ Removed ${toDelete.length} duplicate(s) from ${duplicateGroups} group(s). Check console for details.`);
      onSelectMonIds([]);
      await refresh();
    } catch (err: any) {
      setStatus(`Remove duplicates failed: ${err?.message ?? String(err)}`);
      console.error("Remove duplicates error:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Professor's PC</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label>
          <input type="file" accept=".sav,.SAV" disabled={busy} onChange={onImportSave} />
        </label>
        <button disabled={busy} onClick={onRepair}>
          🔧 Repair Metadata
        </button>
        <button disabled={busy || selectedMonIds.length === 0} onClick={onFixChecksumAndBadEgg} style={{ cursor: selectedMonIds.length === 0 ? 'not-allowed' : 'pointer', backgroundColor: '#ff6b6b', color: 'white', fontWeight: 'bold' }}>
          🔧🥚 Fix Checksums & Bad Egg ({selectedMonIds.length})
        </button>
        <button disabled={busy} onClick={onRemoveDuplicates}>
          🗑️ Remove Duplicates
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input 
            type="checkbox" 
            checked={selectAllToggle} 
            onChange={(e) => onToggleSelectAll(e.target.checked)}
            disabled={busy}
          />
          <span>☑️ Select All</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input 
            type="checkbox" 
            checked={showChecksumFailedOnly} 
            onChange={(e) => setShowChecksumFailedOnly(e.target.checked)}
            disabled={busy}
          />
          <span>⚠️ Checksum Failed Only</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input 
            type="checkbox" 
            checked={showShinyOnly} 
            onChange={(e) => setShowShinyOnly(e.target.checked)}
            disabled={busy}
          />
          <span>✨ Shiny Only</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input 
            type="checkbox" 
            checked={showPokerusOnly} 
            onChange={(e) => setShowPokerusOnly(e.target.checked)}
            disabled={busy}
          />
          <span>🦠 Pokerus Only</span>
        </label>
        <button disabled={busy || selectedMonIds.length === 0} onClick={onDeleteSelected}>
          🗑️ Delete Selected ({selectedMonIds.length})
        </button>
        <button disabled={busy} onClick={onDeleteAll}>
          🗑️ Delete ALL
        </button>
        {busy ? <span>Working…</span> : null}
      </div>

      {status ? <div style={{ marginBottom: 12 }}>{status}</div> : null}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd", backgroundColor: "#f5f5f5" }}>
            <th style={{ padding: 8, width: 40 }}>✓</th>
            <th style={{ padding: 8, minWidth: 100 }}>Name</th>
            <th style={{ padding: 8, minWidth: 80 }}>Species</th>
            <th style={{ padding: 8, width: 90 }}>Exp</th>
            <th style={{ padding: 8, minWidth: 120 }}>OT</th>
            <th style={{ padding: 8, minWidth: 80 }}>Nature</th>
            <th style={{ padding: 8, minWidth: 200 }}>Moves</th>
            <th style={{ padding: 8, width: 80 }}>Item</th>
            <th style={{ padding: 8, width: 60 }}>Pokerus</th>
            <th style={{ padding: 8, width: 80 }}>Source Gen</th>
          </tr>
        </thead>
        <tbody>
          {view.map((m) => {
            const isSelected = selectedMonIds.includes(m.id);
            const moves = m.moves || [];
            const movesDisplay = moves
              .filter(id => id && id > 0)
              .map(id => getMoveName(id))
              .join(", ") || "—";
            
            return (
              <tr key={m.id} style={{ 
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: isSelected ? "#e3f2fd" : undefined 
              }}>
                <td style={{ padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      if (isSelected) {
                        onSelectMonIds(selectedMonIds.filter((id) => id !== m.id));
                      } else {
                        onSelectMonIds([...selectedMonIds, m.id]);
                      }
                    }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <span style={{ fontWeight: 600 }}>
                    {m.disp.displayName}
                    {m.disp.warn ? " ⚠️" : ""}
                    {m.isShiny ? " ✨" : ""}
                  </span>
                </td>
                <td style={{ padding: 8 }}>
                  {m.disp.displaySpecies}
                </td>
                <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>
                  {m.experience?.toLocaleString() || "—"}
                </td>
                <td style={{ padding: 8 }}>
                  {m.otName || "—"}
                  <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>
                    ({m.trainerId ?? "?"})
                  </span>
                </td>
                <td style={{ padding: 8 }}>
                  {m.natureName || "—"}
                </td>
                <td style={{ padding: 8, fontSize: 11 }}>
                  {movesDisplay}
                </td>
                <td style={{ padding: 8, fontSize: 11 }}>
                  {getItemName(m.heldItem)}
                </td>
                <td style={{ padding: 8, fontSize: 11, textAlign: "center" }}>
                  {formatPokerus(m)}
                </td>
                <td style={{ padding: 8, fontSize: 11, textAlign: "center" }}>
                  {m.sourceGen ? m.sourceGen.toUpperCase().replace("GEN", "Gen ") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        <p style={{ margin: "4px 0" }}>
          <strong>Tip:</strong> ⚠️ indicates checksum failed or species out of range. 
          Use "Repair Metadata" to refresh cached data after importing new saves.
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong>Duplicate Detection:</strong> Pokemon are deduplicated based on exact binary data (SHA-256 hash).
          Clones from the same save are automatically filtered.
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong>Pokerus:</strong> 🦠 Active = currently has Pokerus | ✓ Cured = was cured of Pokerus
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong>Source Gen:</strong> Shows which generation the Pokemon originated from.
          Injection rules: Gen 1 → Gen 1/2/3 | Gen 2 → Gen 2/3 | Gen 3 → Gen 3
        </p>
      </div>
    </div>
  );
}
