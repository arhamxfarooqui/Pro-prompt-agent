/**
 * src/offscreen.js
 * Offscreen document — creates the LLM Web Worker in extension origin context.
 * Receives LLM requests from background, forwards to Worker, returns results.
 */

// Worker bridge - creates Worker from extension origin (no CSP issues here)
let worker = null;
const pendingRequests = new Map();
const streamCallbacks = new Map();
let engineReady = false;

function getWorker() {
  if (!worker) {
    worker = new Worker(chrome.runtime.getURL("worker.js"), { type: "module" });
    worker.onmessage = handleWorkerMessage;
    worker.onerror = (e) => console.error("[Offscreen] Worker error:", e.message);
  }
  return worker;
}

function handleWorkerMessage(event) {
  const { type, id, data, error, isWebGPU } = event.data;

  if (type === "INIT_PROGRESS") {
    console.log("[Offscreen] Model loading:", data?.text || data);
    // Forward progress to background → content scripts
    chrome.runtime.sendMessage({
      type: "LLM_DOWNLOAD_PROGRESS",
      progress: data
    }).catch(() => {});
    return;
  }
  if (type === "INIT_COMPLETE") {
    console.log("[Offscreen] Engine ready. WebGPU:", isWebGPU);
    engineReady = true;
    chrome.runtime.sendMessage({
      type: "LLM_READY",
      isWebGPU: isWebGPU
    }).catch(() => {});
    return;
  }
  if (type === "INIT_ERROR") {
    console.error("[Offscreen] Engine init failed:", error);
    chrome.runtime.sendMessage({
      type: "LLM_INIT_ERROR",
      error: error
    }).catch(() => {});
    return;
  }
  if (type === "INIT_STATUS") {
    chrome.runtime.sendMessage({
      type: "LLM_DOWNLOAD_PROGRESS",
      progress: { text: event.data.message || "Initializing..." }
    }).catch(() => {});
    return;
  }

  if (!id) return;

  // Handle streaming tokens
  if (type === "STREAM_TOKEN") {
    const cb = streamCallbacks.get(id);
    if (cb) cb(data);
    return;
  }

  if (type === "STREAM_COMPLETE") {
    const h = pendingRequests.get(id);
    if (h) h.resolve(true);
    streamCallbacks.delete(id);
    pendingRequests.delete(id);
    return;
  }

  if (type === "STREAM_ERROR") {
    const h = pendingRequests.get(id);
    if (h) h.reject(new Error(error));
    streamCallbacks.delete(id);
    pendingRequests.delete(id);
    return;
  }

  // Standard request/response
  const handler = pendingRequests.get(id);
  if (!handler) return;
  type.endsWith("_ERROR") ? handler.reject(new Error(error)) : handler.resolve(data);
  pendingRequests.delete(id);
}

function genId() {
  return "req_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function sendWorkerRequest(type, payload) {
  return new Promise((resolve, reject) => {
    const id = genId();
    pendingRequests.set(id, { resolve, reject });
    getWorker().postMessage({ type, payload: { ...payload, id } });
  });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== "offscreen") return false;

  if (msg.type === "LLM_INIT") {
    getWorker().postMessage({
      type: "INIT_ENGINE",
      payload: { modelName: "gemma-2b-it-q4f16_1-MLC", capVRAM: 2048 }
    });
    sendResponse({ success: true, message: "Init started" });
    return true;
  }

  if (msg.type === "LLM_ORCHESTRATE") {
    (async () => {
      try {
        const result = await sendWorkerRequest("RUN_ORCHESTRATION", {
          prompt: msg.prompt,
          context: msg.context || {}
        });
        sendResponse({ success: true, data: result });
      } catch (err) {
        console.error("[Offscreen] Orchestration error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (msg.type === "LLM_SCORE") {
    (async () => {
      try {
        const result = await sendWorkerRequest("RUN_SCORER", { text: msg.text });
        sendResponse({ success: true, data: result });
      } catch (err) {
        console.error("[Offscreen] Score error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // For streaming, we can't easily stream via sendResponse
  // Return collected tokens instead
  if (msg.type === "LLM_STREAM") {
    (async () => {
      try {
        let fullText = "";
        const id = genId();
        
        const result = await new Promise((resolve, reject) => {
          pendingRequests.set(id, { resolve, reject });
          streamCallbacks.set(id, (token) => { fullText += token; });
          getWorker().postMessage({
            type: "GENERATE_STREAM",
            payload: { id, prompt: msg.prompt }
          });
        });
        
        sendResponse({ success: true, data: fullText });
      } catch (err) {
        console.error("[Offscreen] Stream error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});

console.log("[Offscreen] Document loaded and ready.");
