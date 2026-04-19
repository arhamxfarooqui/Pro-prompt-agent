/**
 * Phase 1.5: Awake Timer System
 * & Component Integration
 */
import { LLMManager, LocalWebLLMBridge } from './engine.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const ALARM_NAME = 'awake-timer';
const ALARM_PERIOD_IN_MINUTES = 20 / 60; // 20 seconds

const llmManager = new LLMManager();
let isEngineLoaded = false;

function registerAwakeTimer() {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: ALARM_PERIOD_IN_MINUTES
      });
      console.log(`[Awake Timer] Alarm registered to ping every 20 seconds.`);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Awake Timer] Extension installed/updated. Initializing timer...');
  registerAwakeTimer();
  
  // Register Context Menu
  chrome.contextMenus.create({
    id: "summarize-page",
    title: "Summarize Page Content with AI",
    contexts: ["page"]
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Awake Timer] Browser started. Re-initializing timer...');
  registerAwakeTimer();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Perform a lightweight asynchronous operation to reset the service worker's idle timer
    await chrome.storage.local.get('dummy_ping_key');
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Awake Timer] Ping! Storage operation performed. Service worker kept alive at ${timestamp}`);
  }
});

// Listener for the Context Menu Integration
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "summarize-page") {
    // Notify the user the extraction process started
    chrome.notifications.create({
      type: "basic",
      iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23000'/%3E%3C/svg%3E",
      title: "Pro-prompt-agent",
      message: "Extracting page context and linking AI..."
    });

    try {
      // 1. Extractor Trigger
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_PAGE_CONTEXT' });
      
      if (!response || !response.success) {
        throw new Error(response ? response.error : 'No response from content parser');
      }

      // 2. Load Local LLM Engine (singleton initialization)
      if (!isEngineLoaded) {
        await llmManager.initEngine();
        await llmManager.loadGemmaModel(); // Takes a few moments for IndexedDB load or heavy fetch
        isEngineLoaded = true;
      }
      
      const bridge = new LocalWebLLMBridge(llmManager);

      // Status checkpoint
      chrome.notifications.create({
        type: "basic",
        iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23000'/%3E%3C/svg%3E",
        title: "Pro-prompt-agent",
        message: "AI processing document. Generating summary..."
      });

      // 3. Inference Run
      const result = await bridge._generate([
        new SystemMessage("You are a fast, concise AI. Summarize the following document into a short paragraph."),
        new HumanMessage(response.text)
      ]);

      const summary = result.generations[0].text;

      // 4. Output Render
      chrome.notifications.create({
        type: "basic",
        iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23000'/%3E%3C/svg%3E",
        title: "Summarized Page",
        message: summary
      });

    } catch (e) {
      console.error(e);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23FF0000'/%3E%3C/svg%3E",
        title: "Analysis Failed",
        message: e.message || "Failed to process the text context."
      });
    }
  }
});
