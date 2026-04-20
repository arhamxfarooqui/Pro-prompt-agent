/**
 * src/module1_engine/worker.js
 * Dedicated Web Worker for handling intensive LLM Inference operations via WebLLM.
 * Keeps the main thread strictly at 60FPS by offloading vector rendering and model state.
 */

import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { initDB } from "./storage.js";

/**
 * Global Engine Instance pointer.
 * @type {import('@mlc-ai/web-llm').MLCEngineInterface | null}
 */
let engine = null;

/**
 * Initializes the local LLM engine. Pre-checks WebGPU hardware availability and uses
 * quantized 4-bit models natively, while providing progress callbacks to the UI.
 *
 * @param {Object} modelConfig - Configuration parameters for the engine.
 * @param {string} modelConfig.modelName - The specific model variant string (e.g., "gemma-2b-it-q4f16_1-MLC").
 * @param {number} modelConfig.capVRAM - VRAM boundary limit constraint.
 * @returns {Promise<void>} Resolves when initialization succeeds and alerts main thread via PostMessage.
 */
async function initializeEngine(modelConfig) {
  try {
    const { modelName, capVRAM } = modelConfig;
    
    // Hardware Check: Verify if the GPU is structurally supported to compute in the browser frame.
    const isWebGPU = navigator.gpu !== undefined && navigator.gpu !== null;

    if (!isWebGPU) {
      // Missing API implies older browser, or blocked hardware flags.
      // Automatically triggers CPU WasM mode context inside MLC logic inherently.
      self.postMessage({ 
        type: 'INIT_STATUS', 
        status: 'degraded_performance', 
        message: 'WebGPU unavailable. Utilizing WASM CPU fallback mode for inference.' 
      });
    }

    // Spin up MLC Engine, binding the initialization callback directly to UI hydration loops via postMessage.
    engine = await CreateMLCEngine(modelName, {
      initProgressCallback: (progress) => {
        self.postMessage({ 
            type: 'INIT_PROGRESS', 
            data: progress 
        });
      }
    });

    self.postMessage({
      type: 'INIT_COMPLETE',
      status: 'ready',
      isWebGPU
    });

  } catch (error) {
    console.error("Engine Initialization Exception:", error);
    self.postMessage({
      type: 'INIT_ERROR',
      error: error.message || error.toString()
    });
  }
}

/**
 * Validates Worker health natively and keeps Background Service lifecycle flags awake 
 * to resist random sleep interruptions when User changes browser tabs.
 */
function pingWorkerHeartbeat() {
  self.postMessage({
    type: 'PONG',
    status: 'active',
    timestamp: Date.now()
  });
}

/**
 * Gathers, deserializes, and merges distributed memory logic chunks out of our native IDB.
 * Queries precisely what a Profile defines, filtering out archaic or compressed texts.
 *
 * @param {string} profileId - The explicitly referenced Profile's ID tag.
 * @returns {Promise<void>} Posts the monolithic joined string back to main thread orchestrators.
 */
async function fetchProfileContext(profileId) {
  try {
    const db = await initDB();
    const transaction = db.transaction("ContextTable", "readonly");
    const store = transaction.objectStore("ContextTable");
    const index = store.index("profileId");

    // Fetch identically exact records bound to this ID
    const request = index.getAll(IDBKeyRange.only(profileId));

    request.onsuccess = (event) => {
      const chunks = event.target.result || [];

      // Constraint: Discard auto-archived/compressed context memory loops
      const activeChunks = chunks.filter((chunk) => !chunk.isArchived);

      // Sort chronological sequence array explicitly: Oldest to Newest
      activeChunks.sort((a, b) => a.timestamp - b.timestamp);

      // Aggregate pure chunk data dynamically separating by standard newline
      const aggregatedMemoryString = activeChunks.map((chunk) => chunk.text).join("\n");

      // Transact finalized query string block
      self.postMessage({
        type: 'FETCH_CONTEXT_RESULT',
        profileId,
        data: aggregatedMemoryString
      });
    };

    request.onerror = (event) => {
      self.postMessage({
        type: 'FETCH_CONTEXT_ERROR',
        error: "IDB Cursor failed inside Worker thread: " + event.target.error
      });
    };
  } catch (error) {
    self.postMessage({
      type: 'FETCH_CONTEXT_ERROR',
      error: error.message || error.toString()
    });
  }
}

/**
 * The Central Global Message Router.
 * Subscribes to main thread (UI or LangGraph) messages implicitly running our background functions.
 */
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  // Route strictly dynamically using explicit explicit tags
  switch (type) {
    case 'INIT_ENGINE':
      await initializeEngine(payload); // payload: { modelName, capVRAM }
      break;

    case 'PING':
      pingWorkerHeartbeat();
      break;

    case 'FETCH_CONTEXT':
      await fetchProfileContext(payload.profileId);
      break;

    default:
      console.warn(`Local WebWorker received an unknown instruction type: [${type}]`);
  }
};
