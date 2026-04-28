# Pro Prompt Engine: Initial Setup & Architecture

This guide covers the scaffolding and configuration for the Pro Prompt Engine, utilizing Vite, React, TypeScript, and the CRXJS Vite plugin for Manifest V3 extension development.

## 1. Project Initialization

Open your terminal and scaffold the base React/TypeScript app. 

# Scaffold the Vite project
npm create vite@latest pro-prompt-engine -- --template react-ts
cd pro-prompt-engine

# Install core dependencies
npm install
npm install -D @crxjs/vite-plugin@beta tailwindcss postcss autoprefixer

# Initialize Tailwind CSS
npx tailwindcss init -p

2. Suggested Directory Architecture
To handle the complexity of three distinct UI surfaces and a background "backend" service worker, restructure your src/ directory into independent modules.

Plaintext
pro-prompt-engine/
├── public/
│   ├── icons/                 # Extension icons (16, 48, 128)
│   └── offscreen.html         # Hidden DOM for WebGPU keep-alive & heavy processing
├── src/
│   ├── background/            # Extension "Backend"
│   │   ├── service-worker.ts  # Main entry point for background tasks
│   │   ├── llm-router.ts      # Routes requests to Groq, Ollama, or WebGPU
│   │   └── heartbeat.ts       # Offscreen document manager to prevent VRAM eviction
│   │
│   ├── content/               # Injected Scripts & UI
│   │   ├── content-script.ts  # DOM observer and message listener
│   │   ├── dom-scraper.ts     # Parses webpages for Context feeding
│   │   └── InjectedToolbar.tsx# React root for the floating UI bar
│   │
│   ├── ui/                    # Standalone Web UIs
│   │   ├── popup/             # Extension Action Popup
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   └── PopupApp.tsx
│   │   │
│   │   └── dashboard/         # Full-page Settings & Profile Manager (Options Page)
│   │       ├── index.html
│   │       ├── main.tsx
│   │       └── DashboardApp.tsx
│   │
│   ├── core/                  # Shared Business Logic
│   │   ├── agents/            # Prompts and multi-agent loop logic
│   │   ├── db/                # IndexedDB wrappers (Dexie.js recommended)
│   │   ├── types/             # Shared TypeScript interfaces
│   │   └── utils/             # Helpers (debounce, PII scrubbers)
│   │
│   └── manifest.json          # CRXJS Manifest V3 configuration
│
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json

3. Core Configurations
A. The Dynamic manifest.json
Instead of a static file, CRXJS allows us to define the manifest dynamically in development and statically in production. Place this in src/manifest.json.

JSON
{
  "manifest_version": 3,
  "name": "Pro Prompt Engine",
  "version": "1.0.0",
  "description": "Dynamic Agentic Prompt Engineering Environment",
  "action": {
    "default_popup": "src/ui/popup/index.html"
  },
  "options_page": "src/ui/dashboard/index.html",
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/content-script.ts"]
    }
  ],
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "alarms",
    "offscreen"
  ],
  "host_permissions": [
    "[https://api.groq.com/](https://api.groq.com/)*",
    "http://localhost:11434/*"
  ]
}
B. The vite.config.ts
Configure Vite to handle the multiple entry points and process the CRXJS plugin.

TypeScript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@ui': resolve(__dirname, './src/ui')
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup/index.html'),
        dashboard: resolve(__dirname, 'src/ui/dashboard/index.html'),
        offscreen: resolve(__dirname, 'public/offscreen.html')
      },
    },
  },
});
C. Tailwind CSS Configuration
Update your tailwind.config.js to ensure styles are compiled across all UI surfaces.

JavaScript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/ui/**/*.{html,tsx,ts}",
    "./src/content/**/*.{html,tsx,ts}",
    "./src/components/**/*.{html,tsx,ts}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#151e2e', // Custom deep dark shade
          950: '#0b0f19',
        }
      }
    },
  },
  plugins: [],
}

4. Next Steps
Run npm run dev. Vite and CRXJS will generate a dist/ folder.

Open Chrome and navigate to chrome://extensions/.

Enable Developer Mode.

Click Load unpacked and select the newly generated dist/ folder.

HMR is now active. Any changes to your React components, background scripts, or content scripts will hot-reload directly in the browser.