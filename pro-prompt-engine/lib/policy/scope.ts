/**
 * Per-origin runtime grants — the scope module. Runs in the service worker.
 *
 * DEFAULT_CAPABILITIES is the empty set of acting verbs (Phase 2 adds
 * perception verbs, Phase 3 adds interaction verbs). A Phase 1 grant
 * registers a content script that does exactly two things: serve snippet
 * expansion and answer a ping. There is no perception, no actuation, no run.
 * See Docs/planning/phase_1_foundation_preconditions.md §4.
 */
import { db } from '@lib/db/dexie-db';
import type { Verb } from '@lib/schemas/action.schema';

export const AGENT_SCRIPT_ID_PREFIX = 'pp-agent-';

export const DEFAULT_CAPABILITIES: Verb[] = [];   // widened in Phase 2 and Phase 3

/** Normalise any URL to the origin form used as the sitePolicy primary key. */
export function toOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin;                       // "https://example.com", no trailing slash
  } catch { return null; }
}

/** The match pattern Chrome wants for an origin: origin + "/*". */
function toMatchPattern(origin: string): string { return `${origin}/*`; }

/**
 * Grant. MUST be called from a user-gesture handler — chrome.permissions.request
 * throws otherwise. Returns false if the user declined; never throws on decline.
 *
 * Failure mode: if registerContentScripts fails after the permission was
 * granted (duplicate id, quota, or a race with reconciliation), the grant is
 * rolled back — chrome.permissions.remove is called and grantOrigin returns
 * false. A held permission with no registered script is worse than no
 * permission, because the popup would show the site as granted while
 * nothing works.
 */
export async function grantOrigin(origin: string): Promise<boolean> {
  const origins = [toMatchPattern(origin)];
  const granted = await chrome.permissions.request({ origins });
  if (!granted) return false;

  try {
    await chrome.scripting.registerContentScripts([{
      id: AGENT_SCRIPT_ID_PREFIX + origin,
      matches: origins,
      // entrypoints/agent.ts is an "unlisted script" (defineUnlistedScript),
      // not a defineContentScript entrypoint — WXT bundles those to the
      // output root, not content-scripts/, and (critically) never adds any
      // static content_scripts/host_permissions entry for it, which is why
      // it is not a defineContentScript in the first place (see that file's
      // header comment).
      js: ['agent.js'],
      runAt: 'document_idle',
      world: 'ISOLATED',                      // explicit: never MAIN (§3.9)
      persistAcrossSessions: true,
    }]);
  } catch (err) {
    console.error('[scope] registerContentScripts failed — rolling back grant', err);
    await chrome.permissions.remove({ origins }).catch(() => {});
    return false;
  }

  await db.sitePolicy.put({
    origin,
    capabilities: DEFAULT_CAPABILITIES,     // see §4.4
    defaultMode: 'supervised',              // PR-AUT-4
    grantedAt: Date.now(),
    revokedAt: undefined,
  });
  return true;
}

/**
 * Revoke. Order matters: unregister the script FIRST so that no new content
 * script can be injected in the window between the permission drop and the
 * unregistration. Then drop the permission, then mark the policy row.
 */
export async function revokeOrigin(origin: string): Promise<void> {
  const id = AGENT_SCRIPT_ID_PREFIX + origin;
  await chrome.scripting.unregisterContentScripts({ ids: [id] }).catch(() => {});
  await chrome.permissions.remove({ origins: [toMatchPattern(origin)] });
  await db.sitePolicy.update(origin, { revokedAt: Date.now() });
  // [Phase 5: halt any run whose scope contains this origin]
}

/**
 * The authoritative scope check. Reads Chrome, not our database, because the
 * user can revoke from chrome://extensions without telling us. The database
 * row is a record of intent; chrome.permissions.contains is the truth.
 */
export async function isGranted(origin: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [toMatchPattern(origin)] });
}

/**
 * chrome.permissions.onRemoved fires when the user revokes from Chrome's own
 * UI, but it does not fire for revocations that happened while the browser
 * was closed. Any sitePolicy row whose permission Chrome no longer holds is
 * marked revoked; the inverse (a registered script for an origin we no
 * longer hold) is also reconciled.
 */
export async function reconcileGrants(): Promise<void> {
  const rows = await db.sitePolicy.filter((r) => r.revokedAt === undefined).toArray();
  for (const row of rows) {
    if (!(await isGranted(row.origin))) await revokeOrigin(row.origin);
  }
  const registered = await chrome.scripting.getRegisteredContentScripts();
  for (const s of registered) {
    const origin = s.id.startsWith(AGENT_SCRIPT_ID_PREFIX)
      ? s.id.slice(AGENT_SCRIPT_ID_PREFIX.length) : null;
    if (origin && !(await isGranted(origin))) {
      await chrome.scripting.unregisterContentScripts({ ids: [s.id] }).catch(() => {});
    }
  }
}
