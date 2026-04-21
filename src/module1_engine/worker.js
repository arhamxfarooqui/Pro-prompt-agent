/**
 * src/module1_engine/worker.js
 * Dedicated Web Worker for handling intensive LLM Inference AND orchestration.
 * ALL heavy ML work (LLM, embeddings, LangGraph) lives here to keep the
 * MV3 Service Worker (background.js) clean and CSP-compliant.
 */

import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { initDB } from "./storage.js";

// ----- Lazy-loaded orchestration modules -----
let _processUserPrompt = null;
let _initSemanticEngine = null;

async function loadOrchestrator() {
  if (!_processUserPrompt) {
    const mod = await import("../module2_brain/orchestrator.js");
    _processUserPrompt = mod.processUserPrompt;
  }
  return _processUserPrompt;
}

async function loadSemanticEngine() {
  if (!_initSemanticEngine) {
    const mod = await import("../module2_brain/semantic.js");
    _initSemanticEngine = mod.initSemanticEngine;
  }
  return _initSemanticEngine;
}

/**
 * Global Engine Instance pointer.
 * @type {import('@mlc-ai/web-llm').MLCEngineInterface | null}
 */
let engine = null;

// ==========================================
// PHASE 1.2: ENGINE INITIALIZATION
// ==========================================

async function initializeEngine(modelConfig) {
  try {
    const { modelName, capVRAM } = modelConfig;
    const isWebGPU = navigator.gpu !== undefined && navigator.gpu !== null;

    if (!isWebGPU) {
      self.postMessage({ 
        type: 'INIT_STATUS', 
        status: 'degraded_performance', 
        message: 'WebGPU unavailable. Utilizing WASM CPU fallback mode for inference.' 
      });
    }

    engine = await CreateMLCEngine(modelName, {
      initProgressCallback: (progress) => {
        self.postMessage({ 
            type: 'INIT_PROGRESS', 
            data: progress 
        });
      }
    });

    // Also initialize the semantic engine after LLM is ready
    try {
      const initSemantic = await loadSemanticEngine();
      await initSemantic();
    } catch (semErr) {
      console.warn("[Worker] Semantic engine init failed (non-fatal):", semErr.message);
    }

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

function pingWorkerHeartbeat() {
  self.postMessage({
    type: 'PONG',
    status: 'active',
    timestamp: Date.now()
  });
}

async function fetchProfileContext(profileId) {
  try {
    const db = await initDB();
    const transaction = db.transaction("ContextTable", "readonly");
    const store = transaction.objectStore("ContextTable");
    const index = store.index("profileId");

    const request = index.getAll(IDBKeyRange.only(profileId));

    request.onsuccess = (event) => {
      const chunks = event.target.result || [];
      const activeChunks = chunks.filter((chunk) => !chunk.isArchived);
      activeChunks.sort((a, b) => a.timestamp - b.timestamp);
      
      const aggregatedMemoryString = activeChunks.map((chunk) => chunk.text).join("\n");

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

// ==========================================
// PHASE 1.3: THE SPEED PIPELINE
// ==========================================

/**
 * Ultra-fast token stream for autocomplete interfaces.
 */
async function generateTextStream(requestId, prompt, systemInstruction = "") {
  try {
    if (!engine) throw new Error("Engine not initialized");
    
    await engine.resetChat();

    const messages = [];
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const asyncChunkGenerator = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.6,
      max_tokens: 512
    });

    for await (const chunk of asyncChunkGenerator) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        self.postMessage({
          type: "STREAM_TOKEN",
          id: requestId,
          data: content
        });
      }
    }

    self.postMessage({
      type: "STREAM_COMPLETE",
      id: requestId
    });
  } catch (error) {
    self.postMessage({
      type: "STREAM_ERROR",
      id: requestId,
      error: error.message || error.toString()
    });
  }
}

/**
 * Executes arrays of agents iteratively.
 */
async function processBatchInference(requestId, batch) {
  try {
    if (!engine) throw new Error("Engine not initialized");
    const results = [];

    for (const agent of batch) {
      await engine.resetChat();

      const response = await engine.chat.completions.create({
        messages: [{ role: "user", content: agent.prompt }],
        stream: false,
        temperature: 0.5
      });
      
      results.push({
        agentId: agent.agentId,
        result: response.choices[0]?.message?.content || ""
      });
    }

    self.postMessage({
      type: "BATCH_COMPLETE",
      id: requestId,
      data: results
    });
  } catch (error) {
    self.postMessage({
      type: "BATCH_ERROR",
      id: requestId,
      error: error.message || error.toString()
    });
  }
}

/**
 * Dedicated prompt scoring evaluator.
 */
async function runStandaloneScorer(requestId, text) {
  try {
    if (!engine) throw new Error("Engine not initialized");
    
    await engine.resetChat();

    const response = await engine.chat.completions.create({
      messages: [
        { role: "system", content: "You are a quantitative prompt scoring agent evaluator. Output ONLY valid JSON. No markdown framing. No conversational filler whatsoever." },
        { role: "user", content: `Evaluate this and respond strictly in JSON formatted { \"score\": number, \"reasoning\": \"string\" }: ${text}` }
      ],
      stream: false,
      temperature: 0.1
    });

    const rawOutput = response.choices[0]?.message?.content || "";
    let parsedObject = { score: 10, reasoning: "Fallback exception: String extraction logic internally crashed." };

    try {
      const match = rawOutput.match(/\{[\s\S]*\}/);
      if (match) {
        parsedObject = JSON.parse(match[0]);
      } else {
        parsedObject = JSON.parse(rawOutput);
      }
    } catch (parseException) {
      console.warn("JSON Parse Filter Hallucination Detected:", rawOutput);
    }

    self.postMessage({
      type: "SCORE_RESULT",
      id: requestId,
      data: parsedObject
    });
  } catch (error) {
    self.postMessage({
      type: "SCORE_ERROR",
      id: requestId,
      error: error.message || error.toString()
    });
  }
}

// ==========================================
// NEW: FULL ORCHESTRATION INSIDE WORKER
// ==========================================

/**
 * Runs the complete LangGraph orchestration pipeline inside this worker.
 * This keeps all heavy deps (LangGraph, ONNX, Transformers) out of background.js.
 */
async function runOrchestration(requestId, payload, context) {
  try {
    const processUserPrompt = await loadOrchestrator();
    const result = await processUserPrompt(payload, context);
    
    self.postMessage({
      type: "ORCHESTRATION_COMPLETE",
      id: requestId,
      data: result
    });
  } catch (error) {
    console.error("[Worker] Orchestration failed:", error);
    self.postMessage({
      type: "ORCHESTRATION_ERROR",
      id: requestId,
      error: error.message || error.toString()
    });
  }
}

// ==========================================
// MESSAGE ROUTER
// ==========================================

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INIT_ENGINE':
      await initializeEngine(payload);
      break;

    case 'PING':
      pingWorkerHeartbeat();
      break;

    case 'FETCH_CONTEXT':
      await fetchProfileContext(payload.profileId);
      break;

    case 'GENERATE_STREAM':
      await generateTextStream(payload.id, payload.prompt, payload.systemInstruction);
      break;

    case 'RUN_BATCH':
      await processBatchInference(payload.id, payload.batch);
      break;

    case 'RUN_SCORER':
      await runStandaloneScorer(payload.id, payload.text);
      break;

    case 'RUN_ORCHESTRATION':
      await runOrchestration(payload.id, payload.prompt, payload.context);
      break;

    default:
      console.warn(`Local WebWorker received an unknown instruction type: [${type}]`);
  }
};
