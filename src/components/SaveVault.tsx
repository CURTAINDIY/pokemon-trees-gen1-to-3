import React, { useEffect, useMemo, useState } from "react";
import { SavedFileRow } from "../db/idb";
import { savesStore } from "../stores/savesStore";
import { downloadBytes } from "../lib/binary/download";
import { GEN3_SAVE_SIZE } from "../lib/gen3/gen3";
import { GEN1_SAVE_SIZE } from "../lib/gen1/gen1";
import { GEN2_SAVE_SIZE } from "../lib/gen2/gen2";
import { professorsPcStore } from "../stores/professorsPcStore";

export function SaveVault(props: { onSelectSaveId?: (id: string) => void }) {
  const [rows, setRows] = useState<SavedFileRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [showHiddenSaves, setShowHiddenSaves] = useState(false);

  const selected = useMemo(() => rows.find(r => r.id === selectedId), [rows, selectedId]);
  
  // Filter rows to hide save_sav files unless showHiddenSaves is true
  const visibleRows = useMemo(() => {
    if (showHiddenSaves) return rows;
    return rows.filter(r => !r.filename.startsWith("save_sav_"));
  }, [rows, showHiddenSaves]);

  async function refresh() {
    const all = await savesStore.list();
    setRows(all);
  }

  useEffect(() => { void refresh(); }, []);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    try {
      const row = await savesStore.importSave(f);
      setStatus(`Imported: ${row.filename}`);
      await refresh();
      setSelectedId(row.id);
      props.onSelectSaveId?.(row.id);
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    }
  }

  function onSelect(id: string) {
    setSelectedId(id);
    props.onSelectSaveId?.(id);
    setStatus("");
  }

  function exportOriginal() {
    if (!selected) return;
    const expectedLen =
      selected.kind === "gen3" ? GEN3_SAVE_SIZE :
      selected.kind === "gen2" ? GEN2_SAVE_SIZE :
      GEN1_SAVE_SIZE;
    downloadBytes(selected.bytes, selected.filename, { expectedLen });
  }

  function showDebug() {
    if (!selected) return;
    if (selected.kind !== "gen3") {
      alert("Debug report is only implemented for Gen 3 saves right now.");
      return;
    }
    console.log("Save bytes:", selected.bytes);
    alert("Debug report printed to console.");
  }

  async function cloneToProfessorsPc() {
    if (!selected || !selected.kind) return;
    try {
      const stats = await professorsPcStore.importFromSave(selected.kind, selected.id, selected.bytes);
      const parts: string[] = [];
      parts.push(`added ${stats.added}`);
      if (stats.skippedDuplicates) parts.push(`skipped ${stats.skippedDuplicates} duplicates`);
      setStatus(`Cloned boxed mons into Professor's PC (${selected.kind?.toUpperCase() || 'UNKNOWN'}): ${parts.join(", ")}.`);
    } catch (err) {
      setStatus(`Clone failed: ${(err as Error).message}`);
    }
  }

  async function deleteSelectedSave() {
    if (!selected) return;
    if (!confirm(`Delete save from vault?

${selected.filename}`)) return;
    try {
      await savesStore.delete(selected.id);
      setStatus(`Deleted: ${selected.filename}`);
      setSelectedId("");
      props.onSelectSaveId?.("");
      await refresh();
    } catch (err) {
      setStatus(`Delete failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="page">
      <h2>Save Vault</h2>

      <div className="row">
        <label className="file">
          <b>Import .sav (Gen 1/2/3)</b>{" "}
          <input type="file" accept=".sav,application/octet-stream" onChange={onImport} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12 }}>
          <input 
            type="checkbox" 
            checked={showHiddenSaves} 
            onChange={(e) => setShowHiddenSaves(e.target.checked)}
          />
          <span>Show Hidden Saves</span>
        </label>
      </div>

      {status && <p className="status">{status}</p>}

      <hr />

      <div className="grid">
        <div className="panel">
          <b>Saved files</b>
          <ul className="list">
            {visibleRows.map(r => (
              <li key={r.id} className={r.id === selectedId ? "selected" : ""}>
                <button onClick={() => onSelect(r.id)}>Select</button>{" "}
                <span>
                  {r.filename} <small style={{ opacity: 0.7 }}>({r.kind?.toUpperCase() || 'UNKNOWN'})</small>
                </span>
                <small> — {new Date(r.createdAt ?? r.uploadedAt).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <b>Selected</b>
          {selected ? (
            <div className="stack">
              <div><code>{selected.filename}</code></div>
              <div>len: {selected.bytes.length}</div>
              {selected.notes ? <div className="hint">Note: {selected.notes}</div> : null}

              <div className="row wrap">
                <button onClick={exportOriginal}>Export .sav</button>
                <button onClick={() => void cloneToProfessorsPc()}>Clone Boxed → Professor’s PC</button>
                <button onClick={showDebug}>Gen3 Debug</button>
                <button className="danger" onClick={() => void deleteSelectedSave()}>Delete from Vault</button>
              </div>
            </div>
          ) : (
            <div className="hint">Select a save to export, debug, or clone boxed Pokémon.</div>
          )}
        </div>
      </div>
    </div>
  );
}
