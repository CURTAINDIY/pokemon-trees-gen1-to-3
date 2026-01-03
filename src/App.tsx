import React, { useState, useMemo } from "react";
import { SaveVault } from "./components/SaveVault";
import ProfessorsPc from "./components/ProfessorsPc";
import { Injector } from "./components/Injector";

type Tab = "vault" | "pc" | "inject";

export default function App() {
  const [tab, setTab] = useState<Tab>("vault");
  const [selectedMonIds, setSelectedMonIds] = useState<string[]>([]);

  function toggleMon(id: string) {
    setSelectedMonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearSelected() {
    setSelectedMonIds([]);
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎮 Pokémon Vault</h1>
        <p className="subtitle">Cross-Generation Save Manager &amp; Transporter</p>
      </header>

      <nav className="tabs">
        <button
          className={tab === "vault" ? "tab active" : "tab"}
          onClick={() => setTab("vault")}
        >
          💾 Save Vault
        </button>
        <button
          className={tab === "pc" ? "tab active" : "tab"}
          onClick={() => setTab("pc")}
        >
          📦 Professor's PC
        </button>
        <button
          className={tab === "inject" ? "tab active" : "tab"}
          onClick={() => setTab("inject")}
        >
          💉 Injector
        </button>
      </nav>

      <main className="content">
        {tab === "vault" && <SaveVault />}
        {tab === "pc" && (
          <ProfessorsPc
            selectedMonIds={selectedMonIds}
            onSelectMonIds={setSelectedMonIds}
          />
        )}
        {tab === "inject" && <Injector selectedMonIds={selectedMonIds} />}
      </main>

      <footer className="footer">
        <p>Offline-first PWA • All data stored locally in your browser</p>
      </footer>
    </div>
  );
}
