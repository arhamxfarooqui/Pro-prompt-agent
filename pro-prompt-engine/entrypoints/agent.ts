/**
 * Agent content script — registered dynamically per granted origin via
 * chrome.scripting.registerContentScripts (lib/policy/scope.ts). This file
 * deliberately does NOT call defineContentScript: any `matches` pattern
 * declared through defineContentScript is written into the manifest's
 * host_permissions at build time (WXT's runtime-registration path still
 * does this, to pre-authorise the pattern), which would silently reintroduce
 * install-time host access — the exact thing this phase removes. Instead
 * this is a plain "unlisted script" entrypoint: WXT bundles it but never
 * references it from the manifest. lib/policy/scope.ts registers it with
 * chrome.scripting.registerContentScripts using the single origin the user
 * just granted, and only that origin.
 *
 * Phase 1 capability set: DEFAULT_CAPABILITIES (lib/policy/scope.ts) is [].
 * This script does exactly two things — serve snippet expansion, and answer
 * a PING (bridged to the page's main world via CustomEvents, since an
 * ISOLATED-world content script does not share a `window` with the page) so
 * the grant/revoke e2e flow has something to observe from outside the
 * extension. Perception (Phase 2) and actuation (Phase 3) attach to this
 * same script in later phases. See
 * Docs/planning/phase_1_foundation_preconditions.md §4.4.
 */
import { SnippetManager } from '@lib/ui/snippet-manager';

export default defineUnlistedScript(() => {
  new SnippetManager();

  // world: 'ISOLATED' (lib/policy/scope.ts) content scripts do not share a
  // `window` with the page. tests/e2e/fixtures define window.__proPromptPing()
  // in the page's own main-world script, which dispatches 'pp-ping' on
  // `document` and awaits 'pp-pong' with a timeout. Both CustomEvents cross
  // the isolated/main boundary because they're dispatched on the shared DOM.
  document.addEventListener('pp-ping', () => {
    document.dispatchEvent(new CustomEvent('pp-pong', { detail: { at: Date.now() } }));
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'PING') {
      sendResponse({ status: 'success', data: { timestamp: Date.now() } });
      return true;
    }
    return undefined;
  });
});
