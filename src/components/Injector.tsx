import { useEffect, useMemo, useState } from "react";
import { idb, ProfessorMonRow, SavedFileRow } from "../db/idb";
import { injectGen3BoxMons, findEmptySlots, GEN3_SAVE_SIZE } from "../lib/gen3/gen3";
import { downloadBytes } from "../lib/binary/download";
import { decodePk3 } from "../lib/gen3/pk3";
import { repairPk3Checksum } from "../lib/gen3/pk3Repair";
import { speciesName } from "../lib/dex/dex";

export function Injector(props: { selectedMonIds: string[] }) {
  const [saves, setSaves] = useState<SavedFileRow[]>([]);
  const [mons, setMons] = useState<ProfessorMonRow[]>([]);
  const [targetSaveId, setTargetSaveId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [emptySlotCount, setEmptySlotCount] = useState<number | null>(null);

  async function refresh() {
    const allSaves = await idb.listSaves();
    setSaves(allSaves);
    const allMons = await idb.listMons();
    setMons(allMons);
  }

  useEffect(() => { void refresh(); }, []);

  const target = useMemo(
    () => saves.find((s) => s.id === targetSaveId),
    [saves, targetSaveId]
  );

  const selectedMons = useMemo(
    () => mons.filter((m) => props.selectedMonIds.includes(m.id)),
    [mons, props.selectedMonIds]
  );

  // Check empty slots when target save changes
  useEffect(() => {
    if (target && target.kind === "gen3") {
      try {
        const emptySlots = findEmptySlots(target.bytes);
        setEmptySlotCount(emptySlots.length);
        setStatus(""); // Clear any previous errors
      } catch (err) {
        console.error("Failed to check empty slots:", err);
        setEmptySlotCount(null);
        setStatus(`⚠️ Save validation failed: ${(err as Error).message}`);
      }
    } else {
      setEmptySlotCount(null);
      setStatus("");
    }
  }, [target]);

  async function doInject() {
    setStatus("");

    if (!target) return setStatus("Pick a target save first.");
    if (target.kind !== "gen3")
      return setStatus("Injection target must be a Gen 3 (128KB) save.");
    if (selectedMons.length === 0)
      return setStatus("Select at least one mon in Professor’s PC.");

    try {
      // Find empty slots for smart placement
      const emptySlots = findEmptySlots(target.bytes);
      
      if (selectedMons.length > emptySlots.length) {
        return setStatus(
          `❌ Not enough empty slots! Save has ${emptySlots.length} empty slots ` +
          `but you selected ${selectedMons.length} Pokémon to inject.`
        );
      }

      // Repair checksums if needed and map selected mons to actual empty slots
      const monsToInject = selectedMons.map((m, idx) => {
        const raw80Copy = new Uint8Array(m.raw80);
        
        // Automatically repair bad checksums
        const decoded = decodePk3(raw80Copy);
        if (!decoded.checksumOk) {
          console.log(`🔧 Repairing checksum for ${decoded.nickname || 'Unknown'} (species ${decoded.speciesId}) before injection...`);
          const newChecksum = repairPk3Checksum(raw80Copy);
          console.log(`  ✅ Checksum repaired: ${newChecksum !== null ? `0x${newChecksum.toString(16).padStart(4, '0')}` : 'FAILED'}`);
        } else {
          console.log(`✓ ${decoded.nickname || 'Unknown'} checksum OK, no repair needed`);
        }
        
        return {
          box: emptySlots[idx].box,
          slot: emptySlots[idx].slot,
          raw80: raw80Copy
        };
      });
      
      console.log(`\n📦 Injecting ${monsToInject.length} Pokemon...`);
      const patchedSave = injectGen3BoxMons(target.bytes, monsToInject);

      console.log("inject complete, patched save size:", patchedSave.length);
      downloadBytes(patchedSave, target.filename, { expectedLen: GEN3_SAVE_SIZE });
      setStatus(`✅ Injected ${selectedMons.length} mon(s). Downloaded patched save.`);
    } catch (err) {
      setStatus(`❌ Inject failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="page">
      <h2>Inject</h2>

      <div className="panel">
        <div className="row wrap">
          <label>
            Target Gen 3 save:{" "}
            <select value={targetSaveId} onChange={(e) => setTargetSaveId(e.target.value)}>
              <option value="">— pick —</option>
              {saves.filter(s => s.kind === "gen3").map(s => (
                <option key={s.id} value={s.id}>{s.filename}</option>
              ))}
            </select>
          </label>

          <button onClick={() => void refresh()}>Refresh</button>
          <button onClick={() => void doInject()}>Inject + Download</button>
        </div>

        {emptySlotCount !== null && (
          <p className="hint">
            Target save has <strong>{emptySlotCount}</strong> empty slot{emptySlotCount !== 1 ? "s" : ""} available.
            {selectedMons.length > 0 && (
              selectedMons.length <= emptySlotCount 
                ? ` ✅ Can inject ${selectedMons.length} selected mon${selectedMons.length !== 1 ? "s" : ""}.`
                : ` ⚠️ Not enough space! Need ${selectedMons.length - emptySlotCount} more slot${selectedMons.length - emptySlotCount !== 1 ? "s" : ""}.`
            )}
          </p>
        )}

        {status && <p className="status">{status}</p>}
      </div>

      <hr />

      <div className="panel">
        <b>Selected mons</b>
        <ul className="list">
          {selectedMons.map((m) => {
            const d = decodePk3(m.raw80);
            const checksumOk = m.checksumOk ?? !!d.checksumOk;
            const speciesId = m.speciesId ?? d.speciesId;
            const nick = (m.nickname ?? d.nickname ?? "").trim();
            
            // Show species name ONLY if checksum OK and valid range
            const showSpecies = checksumOk && speciesId != null && speciesId >= 1 && speciesId <= 386;
            
            const displayName = nick.length 
              ? nick 
              : showSpecies 
                ? speciesName(speciesId!) 
                : "???";
            
            const displaySpecies = showSpecies ? speciesName(speciesId!) : "—";
            const warn = !showSpecies;
            
            return (
              <li key={m.id}>
                <code>{m.id}</code> — <strong>{displayName}{warn ? " ⚠️" : ""}</strong> <span className="muted">species={displaySpecies}{!checksumOk ? " (BAD checksum)" : ""}</span>
              </li>
            );
          })}
        </ul>
        {selectedMons.length === 0 && <p className="hint">No selections. Select mons in Professor’s PC tab.</p>}
      </div>
    </div>
  );
}
