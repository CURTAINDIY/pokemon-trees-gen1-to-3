import { useState } from 'react';
import { professorsPcStore } from '../stores/professorsPcStore';
import { savesStore } from '../stores/savesStore';
import { VaultPokemon } from '../types/vault';
import { injectIntoGen3 } from '../lib/gen3/inject';
import { downloadBlob } from '../lib/binary/download';

function Injector() {
  const [selectedSave, setSelectedSave] = useState<string>('');
  const [selectedPokemon, setSelectedPokemon] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInject = async () => {
    if (!selectedSave) {
      setMessage({ type: 'error', text: 'Please select a save file' });
      return;
    }

    if (selectedPokemon.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one Pokemon' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // Load save data
      const saveData = await savesStore.getSaveData(selectedSave);
      if (!saveData) {
        throw new Error('Failed to load save file');
      }

      // Load Pokemon
      const pokemon: VaultPokemon[] = [];
      for (const id of selectedPokemon) {
        const mon = await professorsPcStore.getPokemon(id);
        if (mon) {
          pokemon.push(mon);
        }
      }

      // Inject Pokemon into save
      const modifiedSave = injectIntoGen3(saveData, pokemon);

      // Download modified save
      const saveMetadata = await savesStore.getSaveMetadata(selectedSave);
      const filename = saveMetadata 
        ? `${saveMetadata.name.replace(/\.sav$/, '')}_injected.sav`
        : 'modified_save.sav';

      downloadBlob(modifiedSave, filename);

      setMessage({ 
        type: 'success', 
        text: `Successfully injected ${pokemon.length} Pokemon! Save file downloaded.` 
      });
    } catch (err) {
      console.error('Injection failed:', err);
      setMessage({ 
        type: 'error', 
        text: `Failed to inject: ${err instanceof Error ? err.message : 'Unknown error'}` 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="injector">
      <div className="card">
        <h2>Inject Pokemon into Save</h2>
        <p>
          Select a Gen 3 save file and Pokemon from your PC to inject. 
          A modified save file will be downloaded.
        </p>

        {message && (
          <div className={message.type === 'success' ? 'success' : 'error'}>
            {message.text}
          </div>
        )}

        <div className="injector-form">
          <div className="form-group">
            <label>Target Save File (Gen 3 only)</label>
            <select
              value={selectedSave}
              onChange={e => setSelectedSave(e.target.value)}
              disabled={isProcessing}
            >
              <option value="">Select a save...</option>
              {/* TODO: Load and display Gen 3 saves */}
            </select>
          </div>

          <div className="form-group">
            <label>Pokemon to Inject</label>
            <div className="pokemon-selector">
              <p className="small">
                Select Pokemon from Professor's PC (multi-select with Ctrl/Cmd)
              </p>
              {/* TODO: Load and display Pokemon list */}
              <select
                multiple
                value={selectedPokemon}
                onChange={e => {
                  const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                  setSelectedPokemon(selected);
                }}
                disabled={isProcessing}
                size={10}
              >
                {/* TODO: Populate options */}
              </select>
            </div>
          </div>

          <button
            onClick={handleInject}
            disabled={isProcessing || !selectedSave || selectedPokemon.length === 0}
            className="inject-button"
          >
            {isProcessing ? (
              <>
                <span className="spinner"></span> Injecting...
              </>
            ) : (
              `Inject ${selectedPokemon.length} Pokemon`
            )}
          </button>
        </div>

        <div className="warning">
          <strong>⚠️ Important:</strong> Always keep a backup of your original save file. 
          The injector modifies the save and downloads a new copy.
        </div>
      </div>
    </div>
  );
}

export default Injector;
