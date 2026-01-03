# Pokemon Trees Gen 1→3: Setup Guide

## 🎯 Project Overview

**pokemon-trees-gen1-to-3** is a public web application for converting and managing Pokemon saves from Generation 1, 2, and 3 with Google Drive cloud storage.

### Key Features
- ✅ Google Authentication with OAuth 2.0
- ✅ Google Drive API integration for cloud storage
- ✅ PCCS-compliant Gen 1/2 → Gen 3 conversion
- ✅ All core logic from pokemon-vault migrated
- ✅ GitHub Actions auto-deployment to GitHub Pages
- ✅ Progressive Web App architecture

## 📋 Current Status

### ✅ Completed
1. Project structure created
2. Google Identity Services integration
3. Google Drive API storage layer
4. Core libraries copied from pokemon-vault
5. React UI components (SaveVault, ProfessorsPc, Injector)
6. GitHub Actions deployment workflow
7. Environment configuration setup

### ⚠️ Known Build Issues
TypeScript compilation errors exist due to:
- Missing export statements in copied modules
- Type mismatches between IndexedDB and Google Drive versions
- Unused imports/variables in diagnostic/debug files

### 🔧 Next Steps to Fix

#### 1. Fix Import/Export Issues
```bash
# Add missing exports to modules:
src/lib/saveDetector.ts        # Export detectGeneration
src/lib/binary/fingerprint.ts  # Export computeFingerprint  
src/lib/binary/download.ts     # Export downloadBlob
src/lib/dex/species.ts          # Export SPECIES
src/lib/gen1/gen1.ts            # Export extractFromGen1, getGen1GameName
src/lib/gen2/gen2.ts            # Export extractFromGen2, getGen2GameName
src/lib/gen3/gen3.ts            # Export extractFromGen3, getGen3GameName
src/lib/gen3/inject.ts          # Export injectIntoGen3
src/lib/transporter/gb_to_pk3.ts # Export convertGen1ToPk3, convertGen2ToPk3
src/lib/transporter/gba_to_pk3.ts # Export convertGen3ToPk3
```

#### 2. Fix NATURES Import
The `gb_to_pk3.ts` file needs to import NATURES from dex:
```typescript
import { NATURES } from '../dex/dex';
```

#### 3. Remove/Update Diagnostic Files
Consider removing these debug/diagnostic files or wrapping in conditional compilation:
- `debugAzumarill.ts` (references IndexedDB)
- `diagnose_gen2.ts` (uses unexported functions)
- `diagnose_save.ts` (uses unexported functions)

## 🚀 Deployment Instructions

### Step 1: Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - `https://YOUR_USERNAME.github.io` (for production)
   - Add authorized redirect URIs:
     - `http://localhost:5173`
     - `https://YOUR_USERNAME.github.io/pokemon-trees-gen1-to-3`
   - Save the Client ID

### Step 2: Local Development

1. Clone/navigate to project:
```bash
cd "Pokemon Tree's/pokemon-trees-gen1-to-3"
```

2. Create `.env.local` file:
```env
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
```

3. Install dependencies:
```bash
npm install
```

4. Fix build errors (see "Next Steps to Fix" above)

5. Run development server:
```bash
npm run dev
```

6. Open `http://localhost:5173` in browser

### Step 3: GitHub Setup

1. Create new GitHub repository:
   - Name: `pokemon-trees-gen1-to-3`
   - Visibility: Public
   - Don't initialize with README (we have one)

2. Initialize git and push:
```bash
cd "Pokemon Tree's/pokemon-trees-gen1-to-3"
git init
git add .
git commit -m "Initial commit: Pokemon Trees Gen 1→3 with Google Drive"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pokemon-trees-gen1-to-3.git
git push -u origin main
```

3. Configure GitHub Pages:
   - Go to repository Settings → Pages
   - Source: "GitHub Actions"

4. Add GitHub Secret:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `VITE_GOOGLE_CLIENT_ID`
   - Value: Your Google OAuth Client ID
   - Save

5. Push changes to trigger deployment:
```bash
git push
```

6. Wait for GitHub Actions to complete (check Actions tab)

7. Site will be live at: `https://YOUR_USERNAME.github.io/pokemon-trees-gen1-to-3/`

## 🔒 Security & Privacy

### Data Storage
- All Pokemon data stored in Google Drive's `appDataFolder`
- This folder is:
  - Hidden from users in Google Drive UI
  - App-specific (only this app can access)
  - Deleted when user revokes app access
  - Doesn't count against storage quota for files <100KB

### Authentication Flow
1. User clicks "Sign in with Google"
2. Google Identity Services prompts for account selection
3. User grants Drive API access (appdata scope only)
4. App receives OAuth 2.0 access token
5. Token stored in browser localStorage
6. All API calls include token in Authorization header

### No Backend
- 100% client-side application
- No server-side processing
- No database (beyond Google Drive)
- All Pokemon conversion happens in browser
- Zero data sent to third parties

## 📊 Architecture

### Storage Layer
```
Google Drive appDataFolder/
├── saves-metadata.json          # Save file index
├── pc-metadata.json              # Pokemon PC index
├── saves/
│   ├── {uuid1}.sav              # Save file binary
│   ├── {uuid2}.sav
│   └── ...
└── pokemon/
    ├── {uuid1}.json             # Pokemon metadata
    ├── {uuid1}.pk3              # PK3 binary data
    ├── {uuid2}.json
    ├── {uuid2}.pk3
    └── ...
```

### Component Hierarchy
```
App.tsx
├── SaveVault.tsx                # Upload & manage saves
├── ProfessorsPc.tsx             # Browse converted Pokemon
└── Injector.tsx                 # Inject Pokemon into saves
```

### Service Layer
```
services/
├── googleAuth.ts                # OAuth 2.0 authentication
└── googleDrive.ts               # Drive API wrapper

stores/
├── savesStore.ts                # Save file management
└── professorsPcStore.ts         # Pokemon storage
```

## 🐛 Troubleshooting

### Build Errors
- Run `npm run build` to see TypeScript errors
- Fix missing exports in lib/ modules
- Remove or fix diagnostic files that reference IndexedDB

### Authentication Issues
- Verify Client ID in `.env.local`
- Check authorized origins in Google Cloud Console
- Ensure `http://` vs `https://` matches
- Clear browser cache and localStorage

### Drive API Errors
- Verify Drive API is enabled in Google Cloud
- Check OAuth scopes include `drive.appdata`
- Ensure access token hasn't expired (1-hour lifetime)
- Try signing out and back in

### GitHub Pages 404
- Verify Actions workflow completed successfully
- Check Pages settings use "GitHub Actions" source
- Ensure `base` in `vite.config.ts` matches repo name
- Wait 5-10 minutes for DNS propagation

## 📝 Future Enhancements

- [ ] Service Worker for offline functionality
- [ ] Bulk Pokemon operations
- [ ] Export Pokemon as .pk3 batch
- [ ] Import from PKHeX format
- [ ] Pokemon stats calculator
- [ ] Move legality checker
- [ ] Shiny probability display
- [ ] Generation 4+ support
- [ ] Trading between saves
- [ ] Cloud sync conflict resolution

## 📚 Resources

- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)
- [PCCS Documentation](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure)
- [Vite Documentation](https://vitejs.dev/)
- [GitHub Pages](https://docs.github.com/en/pages)

## 🤝 Contributing

This is a personal project but contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details
