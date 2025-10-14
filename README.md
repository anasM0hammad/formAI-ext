# FormAI Extension

A Chrome extension to fill the job application form using AI without even you touching the keyboard.

## Project Structure

```
extension/
├── public/
│   ├── manifest.json       # Extension manifest (V3)
│   └── icons/             # Extension icons (16x16, 48x48, 128x128)
├── src/
│   ├── popup/             # Popup UI (React)
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── Popup.tsx
│   │   └── popup.css
│   ├── options/           # Options page (React)
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── Options.tsx
│   │   └── options.css
│   ├── content/           # Content script
│   │   └── index.tsx
│   └── background/        # Background service worker
│       └── index.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. **Add extension icons** (required):
   - Create three PNG icon files: `icon16.png`, `icon48.png`, `icon128.png`
   - Place them in the `public/icons/` folder
   - Or temporarily comment out the icon references in `public/manifest.json`

## Development

1. Build the extension in development mode (with watch):
```bash
npm run dev
```

2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder from this project

3. Make changes to the code and the extension will rebuild automatically
   - Refresh the extension in `chrome://extensions/` to see changes
   - For content script changes, refresh the web page

## Production Build

```bash
npm run build
```


