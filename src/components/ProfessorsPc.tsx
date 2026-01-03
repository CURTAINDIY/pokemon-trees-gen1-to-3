import { useState, useEffect } from 'react';
import { professorsPcStore } from '../stores/professorsPcStore';
import { VaultPokemon } from '../types/vault';
import { SPECIES } from '../lib/dex/species';

function ProfessorsPc() {
  const [pokemon, setPokemon] = useState<VaultPokemon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<{
    search: string;
    generation: number | null;
    shinyOnly: boolean;
  }>({
    search: '',
    generation: null,
    shinyOnly: false,
  });

  useEffect(() => {
    loadPokemon();
  }, []);

  const loadPokemon = async () => {
    try {
      const all = await professorsPcStore.getAllPokemon();
      setPokemon(all);
    } catch (err) {
      console.error('Failed to load Pokemon:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Pokemon?')) {
      return;
    }

    try {
      await professorsPcStore.deletePokemon(id);
      setPokemon(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Failed to delete Pokemon:', err);
    }
  };

  const handleDownloadPK3 = (mon: VaultPokemon) => {
    if (!mon.pk3) {
      alert('No PK3 data available for this Pokemon');
      return;
    }

    const blob = new Blob([mon.pk3], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mon.nickname || SPECIES[mon.natDex]?.name || 'Pokemon'}.pk3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredPokemon = pokemon.filter(p => {
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const speciesName = SPECIES[p.natDex]?.name.toLowerCase() || '';
      const nickname = p.nickname.toLowerCase();
      if (!speciesName.includes(searchLower) && !nickname.includes(searchLower)) {
        return false;
      }
    }
    if (filter.generation !== null && p.sourceGen !== filter.generation) {
      return false;
    }
    if (filter.shinyOnly && !p.isShiny) {
      return false;
    }
    return true;
  });

  const counts = professorsPcStore.getCountByGeneration();

  if (isLoading) {
    return <div className="loading">Loading Pokemon...</div>;
  }

  return (
    <div className="professors-pc">
      <div className="pc-header card">
        <h2>Professor's PC</h2>
        <div className="stats">
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{pokemon.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Gen 1</span>
            <span className="stat-value">{counts.gen1}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Gen 2</span>
            <span className="stat-value">{counts.gen2}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Gen 3</span>
            <span className="stat-value">{counts.gen3}</span>
          </div>
        </div>
      </div>

      <div className="filters card">
        <input
          type="text"
          placeholder="Search by name..."
          value={filter.search}
          onChange={e => setFilter({ ...filter, search: e.target.value })}
          className="search-input"
        />
        
        <select
          value={filter.generation || ''}
          onChange={e => setFilter({ ...filter, generation: e.target.value ? parseInt(e.target.value) : null })}
        >
          <option value="">All Generations</option>
          <option value="1">Gen 1</option>
          <option value="2">Gen 2</option>
          <option value="3">Gen 3</option>
        </select>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={filter.shinyOnly}
            onChange={e => setFilter({ ...filter, shinyOnly: e.target.checked })}
          />
          Shiny Only
        </label>
      </div>

      {filteredPokemon.length === 0 ? (
        <p className="empty-state">
          {pokemon.length === 0 
            ? 'No Pokemon in PC. Extract some from your saves!'
            : 'No Pokemon match your filters.'}
        </p>
      ) : (
        <div className="grid grid-3">
          {filteredPokemon.map(mon => {
            const species = SPECIES[mon.natDex];
            return (
              <div key={mon.id} className="card pokemon-card">
                <div className="pokemon-header">
                  <h3>{mon.nickname || species?.name || `#${mon.natDex}`}</h3>
                  {mon.isShiny && <span className="shiny-badge">✨</span>}
                  <span className="level-badge">Lv. {mon.level}</span>
                </div>

                <div className="pokemon-info">
                  {mon.nickname !== species?.name && (
                    <p><strong>Species:</strong> {species?.name || `#${mon.natDex}`}</p>
                  )}
                  <p><strong>OT:</strong> {mon.ot}</p>
                  <p><strong>Nature:</strong> {mon.nature || 'Unknown'}</p>
                  <p><strong>Source:</strong> Gen {mon.sourceGen} {mon.sourceGame ? `(${mon.sourceGame})` : ''}</p>
                </div>

                <div className="pokemon-stats">
                  <div className="stat-row">
                    <span>HP</span>
                    <span>{mon.hp}</span>
                  </div>
                  <div className="stat-row">
                    <span>Attack</span>
                    <span>{mon.attack}</span>
                  </div>
                  <div className="stat-row">
                    <span>Defense</span>
                    <span>{mon.defense}</span>
                  </div>
                  <div className="stat-row">
                    <span>Sp.Atk</span>
                    <span>{mon.spAttack}</span>
                  </div>
                  <div className="stat-row">
                    <span>Sp.Def</span>
                    <span>{mon.spDefense}</span>
                  </div>
                  <div className="stat-row">
                    <span>Speed</span>
                    <span>{mon.speed}</span>
                  </div>
                </div>

                <div className="pokemon-actions">
                  <button onClick={() => handleDownloadPK3(mon)}>
                    Download .pk3
                  </button>
                  <button onClick={() => handleDelete(mon.id)} className="danger">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProfessorsPc;
