/**
 * @file background.js — Service worker for the Local Agentic Orchestrator.
 *
 * Every callback is exported as a named function so it can be
 * individually unit-tested without touching Chrome APIs.
 */

import { detectWebGPUSupport } from './utils/SystemCheck.js';

// ──────────────────────────────────────────────
// Exported Handlers (fully testable in isolation)
// ──────────────────────────────────────────────

/**
 * Handles the chrome.runtime.onInstalled event.
 * Logs a structured initialisation message.
 *
 * @param {chrome.runtime.InstalledDetails} details
 */
export async function handleInstalled(details) {
  console.log('[Orchestrator] Service worker installed.', {
    reason: details.reason,
    version: chrome.runtime.getManifest?.().version ?? '0.1.0',
    timestamp: Date.now(),
  });

  // Run hardware diagnostics immediately on install.
  const hardware = await detectWebGPUSupport();
  console.log('[Orchestrator] Hardware mode resolved:', hardware.mode);
}

/**
 * Handles incoming chrome.runtime.onMessage events.
 *
 * Currently supports:
 *   • PING_TEST — health-check probe used by integration tests.
 *
 * @param   {Object}   message      Message payload.
 * @param   {Object}   sender       Sender metadata.
 * @param   {Function} sendResponse Callback to reply to the sender.
 * @returns {boolean}  `true` to keep the messaging channel open for
 *                      async responses (required by the Chrome API).
 */
export function handleMessage(message, sender, sendResponse) {
  if (message.action === 'PING_TEST') {
    sendResponse({ status: 'WORKER_ACTIVE' });
  }

  // Return true to signal that sendResponse may be called asynchronously.
  return true;
}

// ──────────────────────────────────────────────
// Wire listeners ONLY when running inside the extension runtime.
// ──────────────────────────────────────────────
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener(handleInstalled);
  chrome.runtime.onMessage.addListener(handleMessage);
}
