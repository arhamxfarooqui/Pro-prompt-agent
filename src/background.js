/**
 * src/background.js
 * MV3 Service Worker — storage router + offscreen document manager.
 * Routes LLM operations to an offscreen document (which can safely create Workers).
 */

import * as storage from "./module1_engine/storage.js";

let offscreenCreated = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["WORKERS"],
      justification: "LLM inference via Web Worker for prompt orchestration"
    });
    offscreenCreated = true;
    console.log("[SW] Offscreen document created.");
  } catch (e) {
    if (e.message && e.message.includes("already exists")) {
      offscreenCreated = true;
    } else {
      console.error("[SW] Failed to create offscreen document:", e);
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // === STORAGE OPERATIONS ===

  if (msg.type === "GET_STORAGE_CONTEXT") {
    (async () => {
      try {
        const profile = await storage.getProfile("default");
        const chunks = await storage.getContextChunks();
        let tags = (profile && profile.preferences) ? profile.preferences : [];
        let pageData = (chunks && chunks.length > 0) ? chunks[chunks.length - 1].text : "";
        sendResponse({ success: true, data: { profileTags: tags, pageData: pageData } });
      } catch (err) {
        console.error("[SW] GET_STORAGE_CONTEXT error:", err);
        sendResponse({ success: true, data: { profileTags: [], pageData: "" } });
      }
    })();
    return true;
  }

  if (msg.type === "SAVE_SCRAPED_CONTEXT") {
    (async () => {
      try {
        // saveContextChunk(profileId, rawText, source)
        await storage.saveContextChunk("default", msg.payload, "Scraper");
        sendResponse({ success: true });
      } catch (err) {
        console.error("[SW] SAVE_SCRAPED_CONTEXT error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "SAVE_PROFILE_TAGS") {
    (async () => {
      try {
        await storage.createNewProfile({ 
          name: "Manual Active Tags", 
          initialRules: msg.payload.join(", ") 
        });
        sendResponse({ success: true });
      } catch (err) {
        console.error("[SW] SAVE_PROFILE_TAGS error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "SAVE_SNIPPET") {
    (async () => {
      try {
        await storage.saveSnippet("snip_" + Date.now(), msg.payload);
        sendResponse({ success: true });
      } catch (err) {
        console.error("[SW] SAVE_SNIPPET error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "GET_SNIPPETS") {
    (async () => {
      try {
        const raws = await storage.getAllSnippets();
        const data = raws.map(s => ({ text: s.bodyText }));
        sendResponse({ success: true, data: data });
      } catch (err) {
        console.error("[SW] GET_SNIPPETS error:", err);
        sendResponse({ success: true, data: [] });
      }
    })();
    return true;
  }

  // === LLM OPERATIONS (forwarded to offscreen document) ===

  if (msg.type === "LLM_INIT" || msg.type === "LLM_ORCHESTRATE" || 
      msg.type === "LLM_SCORE" || msg.type === "LLM_STREAM") {
    (async () => {
      try {
        await ensureOffscreen();
        // Forward to offscreen document
        chrome.runtime.sendMessage({ target: "offscreen", ...msg }, (response) => {
          sendResponse(response || { success: false, error: "No response from offscreen" });
        });
      } catch (err) {
        console.error("[SW] LLM forward error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Messages from offscreen with target "background" are handled here
  if (msg.target === "offscreen") {
    // Offscreen handles these internally
    return false;
  }

  // === PROGRESS BROADCASTS FROM OFFSCREEN → ALL TABS ===

  if (msg.type === "LLM_DOWNLOAD_PROGRESS" || msg.type === "LLM_READY" || msg.type === "LLM_INIT_ERROR") {
    // Broadcast to all tabs so content scripts can show progress UI
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
        }
      }
    });
    return false;
  }
});
