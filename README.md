# Pokemon Trees: Gen 1→3 Converter

A public web application for managing and converting Pokemon saves from Generation 1, 2, and 3 with cloud storage via Google Drive.

## Features

- **PCCS-Compliant Conversion**: Convert Gen 1/2 Pokemon to Gen 3 format following Pokemon Community Conversion Standard
- **Google Drive Integration**: Store your save files and converted Pokemon securely in your Google Drive
- **Google Authentication**: Sign in with your Google account for secure access
- **Cross-Generation Support**: 
  - Gen 1: Red, Blue, Yellow (GB)
  - Gen 2: Gold, Silver, Crystal (GBC)
  - Gen 3: Ruby, Sapphire, Emerald, FireRed, LeafGreen (GBA)
- **Save Management**: Upload, organize, and manage multiple save files
- **Professor's PC**: Storage system for converted Pokemon across generations
- **Corruption Detection**: Automatic detection and repair of corrupt Pokemon data
- **Offline Support**: Progressive Web App with service worker caching

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Storage**: Google Drive API (Appdata folder)
- **Authentication**: Google Identity Services
- **Hosting**: GitHub Pages
- **Deployment**: GitHub Actions

## Development

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Platform project with Drive API enabled
- OAuth 2.0 Client ID for web application

### Setup

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/pokemon-trees-gen1-to-3.git
cd pokemon-trees-gen1-to-3
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file with your Google OAuth credentials:
```env
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

4. Run development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Google Drive Setup

The app stores data in your Google Drive's Application Data folder (`appDataFolder`), which:
- Is hidden from the user in Google Drive UI
- Is specific to this application
- Gets deleted when the user revokes access
- Doesn't count against storage quota for files <100KB

### Data Structure

```
appDataFolder/
├── saves/              # Pokemon save files
│   ├── {save-id}.sav
│   └── metadata.json
└── professors-pc/      # Converted Pokemon storage
    ├── {pokemon-id}.pk3
    └── metadata.json
```

## Deployment

Automated deployment via GitHub Actions:

1. Push to `main` branch triggers build
2. GitHub Actions builds the app
3. Deploys to GitHub Pages at `https://YOUR_USERNAME.github.io/pokemon-trees-gen1-to-3/`

## Architecture

### Storage Layer

- **GoogleDriveStorage**: Client-side Google Drive API integration
- **SavesStore**: Save file management and metadata
- **ProfessorsPcStore**: Converted Pokemon storage
- **CacheManager**: Local caching for offline support

### Core Libraries

- **gen1/gen2/gen3**: Generation-specific save parsing
- **transporter**: PCCS-compliant conversion logic
- **validation**: Data integrity and corruption detection
- **binary**: Utilities for byte manipulation, hashing, encoding

## Privacy & Security

- **Client-Side Only**: All processing happens in your browser
- **Your Data, Your Drive**: Data stored only in your Google Drive
- **No Backend**: No server-side processing or data storage
- **Open Source**: Fully auditable codebase

## License

MIT License - See LICENSE file for details

## Credits

Based on the Pokemon Community Conversion Standard (PCCS) for generation migration.
