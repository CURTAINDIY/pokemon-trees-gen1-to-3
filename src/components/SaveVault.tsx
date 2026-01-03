import { useState, useEffect } from 'react';
import { savesStore } from '../stores/savesStore';
import { professorsPcStore } from '../stores/professorsPcStore';
import { SaveMetadata } from '../types/vault';
import { detectGeneration, detectSystemFromSaveSize } from '../lib/saveDetector';
import { computeFingerprint } from '../lib/binary/fingerprint';
import { uuid } from '../lib/binary/uuid';
import { extractFromGen1, getGen1GameName } from '../lib/gen1/gen1';
import { extractFromGen2, getGen2GameName } from '../lib/gen2/gen2';
import { extractFromGen3, getGen3GameName } from '../lib/gen3/gen3';
import { convertGen1ToPk3, convertGen2ToPk3 } from '../lib/transporter/gb_to_pk3';
import { convertGen3ToPk3 } from '../lib/transporter/gba_to_pk3';

function SaveVault() {
  const [saves, setSaves] = useState<SaveMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  useEffect(() => {
    loadSaves();
  }, []);

  const loadSaves = async () => {
    try {
      const allSaves = await savesStore.getAllSaves();
      setSaves(allSaves.sort((a, b) => b.uploadedAt - a.uploadedAt));
    } catch (err) {
      setError('Failed to load saves');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Processing ${i + 1}/${files.length}: ${file.name}`);

        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        // Detect generation and system
        const generation = detectGeneration(data);
        const system = detectSystemFromSaveSize(data.byteLength);
        const fingerprint = await computeFingerprint(data);
        
        // Get game name
        let game = 'Unknown';
        try {
          if (generation === 1) {
            game = getGen1GameName(data);
          } else if (generation === 2) {
            game = getGen2GameName(data);
          } else if (generation === 3) {
            game = getGen3GameName(data);
          }
        } catch (err) {
          console.warn('Could not detect game name:', err);
        }

        // Check for duplicates
        const existing = saves.find(s => s.fingerprint === fingerprint);
        if (existing) {
          console.log(`Skipping duplicate: ${file.name} (matches ${existing.name})`);
          continue;
        }

        // Add to store
        const saveId = uuid();
        const metadata = await savesStore.addSave(
          saveId,
          file.name,
          file.name,
          data,
          {
            system,
            generation,
            game,
            fingerprint,
          }
        );

        setSaves(prev => [metadata, ...prev]);
      }

      setUploadProgress(`Successfully uploaded ${files.length} save(s)`);
    } catch (err) {
      setError(`Failed to upload: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error(err);
    } finally {
      setIsUploading(false);
      // Clear file input
      event.target.value = '';
    }
  };

  const handleExtractPokemon = async (save: SaveMetadata) => {
    if (!save.generation || !save.id) {
      setError('Invalid save file');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(`Extracting Pokemon from ${save.name}...`);

    try {
      const data = await savesStore.getSaveData(save.id);
      if (!data) {
        throw new Error('Failed to load save data');
      }

      let extracted: any[] = [];

      if (save.generation === 1) {
        const party = extractFromGen1(data, 'party');
        const box = extractFromGen1(data, 'box');
        extracted = [...party, ...box];
      } else if (save.generation === 2) {
        const party = extractFromGen2(data, 'party');
        const box = extractFromGen2(data, 'box');
        extracted = [...party, ...box];
      } else if (save.generation === 3) {
        extracted = extractFromGen3(data);
      }

      setUploadProgress(`Converting ${extracted.length} Pokemon...`);

      // Convert to PK3 format and add to Professor's PC
      for (let i = 0; i < extracted.length; i++) {
        const mon = extracted[i];
        
        let vaultMon;
        if (save.generation === 1) {
          vaultMon = convertGen1ToPk3(mon, save.game || 'Red');
        } else if (save.generation === 2) {
          vaultMon = convertGen2ToPk3(mon, save.game || 'Gold');
        } else {
          vaultMon = convertGen3ToPk3(mon);
        }

        await professorsPcStore.addPokemon(vaultMon);
      }

      setUploadProgress(`✓ Successfully extracted ${extracted.length} Pokemon!`);
      setTimeout(() => setUploadProgress(''), 3000);
    } catch (err) {
      setError(`Failed to extract: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSave = async (saveId: string) => {
    if (!confirm('Are you sure you want to delete this save?')) {
      return;
    }

    try {
      await savesStore.deleteSave(saveId);
      setSaves(prev => prev.filter(s => s.id !== saveId));
    } catch (err) {
      setError('Failed to delete save');
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading saves...</div>;
  }

  return (
    <div className="save-vault">
      <div className="upload-section card">
        <h2>Upload Save Files</h2>
        <p>Upload Pokemon save files from Gen 1, 2, or 3 (.sav files)</p>
        
        <input
          type="file"
          accept=".sav,.gb,.gbc,.gba"
          multiple
          onChange={handleFileUpload}
          disabled={isUploading}
          id="file-upload"
          style={{ display: 'none' }}
        />
        
        <label htmlFor="file-upload" className="upload-area">
          {isUploading ? (
            <div>
              <div className="spinner"></div>
              <p>{uploadProgress}</p>
            </div>
          ) : (
            <div>
              <p>📁 Click to select save files</p>
              <p className="small">Supports .sav files from GB, GBC, and GBA games</p>
            </div>
          )}
        </label>
      </div>

      {error && <div className="error">{error}</div>}
      {uploadProgress && !isUploading && <div className="success">{uploadProgress}</div>}

      <div className="saves-list">
        <h2>Your Saves ({saves.length})</h2>
        
        {saves.length === 0 ? (
          <p className="empty-state">No saves uploaded yet. Upload your first save file above!</p>
        ) : (
          <div className="grid grid-2">
            {saves.map(save => (
              <div key={save.id} className="card save-card">
                <div className="save-header">
                  <h3>{save.name}</h3>
                  <span className="badge">{save.system}</span>
                </div>
                
                <div className="save-info">
                  <p><strong>Game:</strong> {save.game || 'Unknown'}</p>
                  <p><strong>Generation:</strong> {save.generation || 'Unknown'}</p>
                  <p><strong>Size:</strong> {(save.size / 1024).toFixed(1)} KB</p>
                  <p><strong>Uploaded:</strong> {new Date(save.uploadedAt).toLocaleDateString()}</p>
                </div>

                <div className="save-actions">
                  <button 
                    onClick={() => handleExtractPokemon(save)}
                    disabled={isUploading}
                  >
                    Extract Pokemon
                  </button>
                  <button 
                    onClick={() => handleDeleteSave(save.id)}
                    className="danger"
                    disabled={isUploading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SaveVault;
