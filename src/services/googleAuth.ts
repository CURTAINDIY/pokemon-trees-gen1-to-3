import { GoogleUser, AuthState } from '../types/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata', // Access to app-specific folder
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

type AuthListener = (state: AuthState) => void;

class GoogleAuthService {
  private listeners: Set<AuthListener> = new Set();
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    idToken: null,
  };
  private tokenClient: any = null;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Initialize Google Identity Services
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise((resolve, reject) => {
      if (!GOOGLE_CLIENT_ID) {
        reject(new Error('Google Client ID not configured'));
        return;
      }

      // Wait for Google API to load
      const checkGoogle = setInterval(() => {
        if (window.google?.accounts) {
          clearInterval(checkGoogle);

          // Initialize ID token flow (for user info)
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: this.handleCredentialResponse.bind(this),
            auto_select: false,
          });

          // Initialize OAuth2 token flow (for API access)
          this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: this.handleTokenResponse.bind(this),
          });

          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkGoogle);
        reject(new Error('Google API failed to load'));
      }, 10000);
    });

    return this.initializationPromise;
  }

  /**
   * Handle ID token credential response
   */
  private handleCredentialResponse(response: any): void {
    try {
      // Decode JWT (simple base64 decode, not cryptographically verified)
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      
      const user: GoogleUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };

      this.authState = {
        ...this.authState,
        isAuthenticated: true,
        user,
        idToken: response.credential,
      };

      this.saveToStorage();
      this.notifyListeners();

      // Request access token for Drive API
      this.tokenClient?.requestAccessToken();
    } catch (error) {
      console.error('Failed to process credential:', error);
    }
  }

  /**
   * Handle OAuth2 access token response
   */
  private handleTokenResponse(response: any): void {
    if (response.error) {
      console.error('Token error:', response.error);
      return;
    }

    this.authState = {
      ...this.authState,
      accessToken: response.access_token,
    };

    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Sign in user
   */
  async signIn(): Promise<void> {
    await this.initialize();
    
    // Use One Tap if available, otherwise show account chooser
    window.google?.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isDismissedMoment()) {
        // Fallback: request token directly
        this.tokenClient?.requestAccessToken({ prompt: 'consent' });
      }
    });
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    // Revoke access token
    if (this.authState.accessToken) {
      window.google?.accounts.oauth2.revoke(this.authState.accessToken);
    }

    // Revoke Google Sign-In
    if (this.authState.user) {
      window.google?.accounts.id.disableAutoSelect();
    }

    this.authState = {
      isAuthenticated: false,
      user: null,
      accessToken: null,
      idToken: null,
    };

    this.clearStorage();
    this.notifyListeners();
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Get access token for API calls
   */
  getAccessToken(): string | null {
    return this.authState.accessToken;
  }

  /**
   * Check if token is expired (simple check, assumes 1 hour expiry)
   */
  isTokenExpired(): boolean {
    const tokenTime = localStorage.getItem('google_token_time');
    if (!tokenTime) return true;

    const elapsed = Date.now() - parseInt(tokenTime);
    return elapsed > 3600000; // 1 hour in milliseconds
  }

  /**
   * Refresh access token if needed
   */
  async ensureValidToken(): Promise<string> {
    if (!this.authState.accessToken || this.isTokenExpired()) {
      return new Promise((resolve, reject) => {
        const originalCallback = this.tokenClient?.callback;
        
        this.tokenClient.callback = (response: any) => {
          originalCallback(response);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.access_token);
          }
        };

        this.tokenClient?.requestAccessToken({ prompt: '' });
      });
    }

    return this.authState.accessToken;
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    // Immediately notify new listener
    listener(this.authState);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.authState));
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('google_auth_state', JSON.stringify(this.authState));
      if (this.authState.accessToken) {
        localStorage.setItem('google_token_time', Date.now().toString());
      }
    } catch (error) {
      console.error('Failed to save auth state:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('google_auth_state');
      if (stored) {
        this.authState = JSON.parse(stored);
        
        // Clear if token is expired
        if (this.isTokenExpired()) {
          this.clearStorage();
          this.authState = {
            isAuthenticated: false,
            user: null,
            accessToken: null,
            idToken: null,
          };
        }
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
    }
  }

  private clearStorage(): void {
    localStorage.removeItem('google_auth_state');
    localStorage.removeItem('google_token_time');
  }
}

// Export singleton instance
export const googleAuth = new GoogleAuthService();
