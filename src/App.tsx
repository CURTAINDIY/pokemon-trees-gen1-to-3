import { useState, useEffect } from 'react';
import { googleAuth } from './services/googleAuth';
import { savesStore } from './stores/savesStore';
import { professorsPcStore } from './stores/professorsPcStore';
import { AuthState } from './types/google';
import SaveVault from './components/SaveVault';
import ProfessorsPc from './components/ProfessorsPc';
import Injector from './components/Injector';

type Tab = 'vault' | 'pc' | 'injector';

function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    idToken: null,
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('vault');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = googleAuth.subscribe((state) => {
      setAuthState(state);
      
      // Load data when authenticated
      if (state.isAuthenticated && state.accessToken && !isLoadingData) {
        loadData();
      }
    });

    // Initialize Google Auth
    googleAuth.initialize()
      .catch((err) => {
        console.error('Failed to initialize Google Auth:', err);
        setError('Failed to initialize Google Sign-In. Please refresh the page.');
      })
      .finally(() => {
        setIsInitializing(false);
      });

    return unsubscribe;
  }, []);

  const loadData = async () => {
    setIsLoadingData(true);
    setError(null);
    
    try {
      await Promise.all([
        savesStore.initialize(),
        professorsPcStore.initialize(),
      ]);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data from Google Drive. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    try {
      await googleAuth.signIn();
    } catch (err) {
      console.error('Sign in failed:', err);
      setError('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await googleAuth.signOut();
      savesStore.clearCache();
      professorsPcStore.clearCache();
    } catch (err) {
      console.error('Sign out failed:', err);
      setError('Failed to sign out. Please try again.');
    }
  };

  if (isInitializing) {
    return (
      <div className="loading-screen">
        <h1>Pokemon Trees: Gen 1→3</h1>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="auth-screen">
        <div className="auth-card card">
          <h1>🌳 Pokemon Trees</h1>
          <h2>Gen 1→3 Converter</h2>
          
          <p>
            Convert and manage your Pokemon saves from Generation 1, 2, and 3 
            with secure cloud storage via Google Drive.
          </p>

          <div className="features">
            <div className="feature">
              <h3>🔒 Secure Cloud Storage</h3>
              <p>Your data is stored safely in your Google Drive</p>
            </div>
            <div className="feature">
              <h3>🔄 PCCS-Compliant Conversion</h3>
              <p>Convert Gen 1/2 Pokemon to Gen 3 format</p>
            </div>
            <div className="feature">
              <h3>💾 Multi-Save Management</h3>
              <p>Organize and manage multiple save files</p>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <button onClick={handleSignIn} className="sign-in-button">
            Sign in with Google
          </button>

          <p className="privacy-note">
            This app only accesses its own private folder in your Google Drive. 
            Your data never leaves your browser or Google Drive.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>🌳 Pokemon Trees</h1>
          {isLoadingData && <div className="spinner"></div>}
        </div>
        
        <div className="user-profile">
          {authState.user && (
            <>
              <img 
                src={authState.user.picture} 
                alt={authState.user.name}
                className="user-avatar"
              />
              <span className="user-name">{authState.user.name}</span>
            </>
          )}
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          💾 Save Vault
        </button>
        <button 
          className={`tab ${activeTab === 'pc' ? 'active' : ''}`}
          onClick={() => setActiveTab('pc')}
        >
          🏠 Professor's PC
        </button>
        <button 
          className={`tab ${activeTab === 'injector' ? 'active' : ''}`}
          onClick={() => setActiveTab('injector')}
        >
          💉 Injector
        </button>
      </div>

      <main className="main-content">
        {activeTab === 'vault' && <SaveVault />}
        {activeTab === 'pc' && <ProfessorsPc />}
        {activeTab === 'injector' && <Injector />}
      </main>

      <footer className="footer">
        <p>
          Open source project • Data stored in your Google Drive • 
          <a href="https://github.com/YOUR_USERNAME/pokemon-trees-gen1-to-3" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
