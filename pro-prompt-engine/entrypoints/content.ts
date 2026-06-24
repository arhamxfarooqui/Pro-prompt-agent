/**
 * Content Script — Keep-Alive Pinger & Target Site Detection
 *
 * WXT content script entrypoint. Handles:
 * 1. Bidirectional keep-alive ping (CS → SW every 20s)
 * 2. Receiving SW heartbeats (SW → CS) and responding
 * 3. Message bridge for toolbar actions
 */

import { Readability } from '@mozilla/readability';
import { SnippetManager } from '@lib/ui/snippet-manager';
import { AutocompleteManager } from '@lib/ui/autocomplete-manager';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main(ctx) {
    console.log('[Pro Prompt] Content script loaded');

    // Init UI Managers
    new SnippetManager();
    new AutocompleteManager();

    // ════════════════════════════════════════
    // Bidirectional Keep-Alive Ping System
    // CS → SW ping every 20 seconds
    // ════════════════════════════════════════

    const keepAliveInterval = ctx.setInterval(async () => {
      try {
        const result = await chrome.storage.local.get('activeProvider');
        const provider = result.activeProvider || 'webgpu';
        if (provider !== 'webgpu') return; // Only ping for WebGPU — pinging Groq/Ollama is pointless

        await chrome.runtime.sendMessage({ type: 'KEEP_ALIVE_PING' });
      } catch {
        console.warn('[Pro Prompt] SW ping failed — SW may have restarted');
      }
    }, 20_000);

    // ════════════════════════════════════════
    // Receive SW → CS heartbeats
    // ════════════════════════════════════════

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'SW_HEARTBEAT':
          sendResponse({ type: 'SW_HEARTBEAT_ACK', timestamp: Date.now() });
          break;

        case 'INJECT_TOOLBAR':
          sendResponse({ status: 'success' });
          break;

        case 'SCAN_WEBPAGE': {
          sendResponse({
            status: 'success',
            data: {
              title: document.title,
              url: window.location.href,
              content: extractPageContent(),
            },
          });
          break;
        }

        case 'TOGGLE_AUTOCOMPLETE':
        case 'TOGGLE_TEXT_SELECT':
          sendResponse({ status: 'success', data: { enabled: message.payload?.enabled } });
          break;
      }

      return true;
    });

    /**
     * Extract meaningful text from the page using Readability.
     */
    function extractPageContent(): string {
      try {
        const clone = document.cloneNode(true) as Document;
        const reader = new Readability(clone);
        const article = reader.parse();
        
        if (article && article.textContent) {
           return article.textContent.replace(/\s+/g, ' ').trim().slice(0, 15000);
        }
      } catch (err) {
        console.warn('[Pro Prompt] Readability failed, falling back to basic extraction', err);
      }
      
      const bodyClone = document.body.cloneNode(true) as HTMLElement;
      ['script', 'style', 'nav', 'header', 'footer', 'noscript', '[aria-hidden="true"]']
        .forEach(sel => bodyClone.querySelectorAll(sel).forEach(el => el.remove()));
      bodyClone.querySelectorAll('#pro-prompt-toolbar-host').forEach(el => el.remove());
      return (bodyClone.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000);
    }
  },
});
