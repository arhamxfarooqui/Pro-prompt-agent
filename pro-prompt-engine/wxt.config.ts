import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Pro Prompt Engine',
    version: '1.0.0',
    description: 'Dynamic Agentic Prompt Engineering Environment — Refactor, score, and generate high-quality prompts with local-first AI.',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'alarms',
      'offscreen',
    ],
    host_permissions: [
      'https://api.groq.com/*',
      'http://localhost:11434/*',
    ],
    web_accessible_resources: [
      {
        matches: ['<all_urls>'],
        resources: ['offscreen.html', '*.css'],
      },
    ],
    options_ui: {
      page: "options.html",
      open_in_tab: true
    },
  },
  // Path aliases for clean imports
  alias: {
    '@lib': './lib',
    '@components': './components',
  },
});
