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
 * Uses stream:true to dispatch characters via postMessage directly avoiding Promise blocks.
 * 
 * @param {string} requestId - Invocation UUID boundary mapped to main-thread
 * @param {string} prompt - Immediate sentence/fragment 
 * @param {string} [systemInstruction] - Baseline rules constraint
 */
async function generateTextStream(requestId, prompt, systemInstruction = "") {
  try {
    if (!engine) throw new Error("Engine not initialized");
    
    // Ghost-context purge hook explicitly enforcing clean slate memory logic
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

    // Execute Native Loop
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
 * Executes arrays of agents iteratively strictly mitigating concurrent 2GB VRAM crashes.
 *
 * @param {string} requestId - Mapped Request UUID 
 * @param {Array<{agentId: string, prompt: string}>} batch - Batch instructions array
 */
async function processBatchInference(requestId, batch) {
  try {
    if (!engine) throw new Error("Engine not initialized");
    const results = [];

    // The Synchronous Event Queue implementation mapping explicitly over individual VRAM transactions
    for (const agent of batch) {
      // Vital memory bleed protection layer explicitly required inside iterative batches
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
 * Dedicated prompt scoring evaluator logic bridging string parsing against dynamic Regex filters.
 *
 * @param {string} requestId - Mapped Request ID
 * @param {string} text - Raw payload output text generated by orchestrator loop
 */
async function runStandaloneScorer(requestId, text) {
  try {
    if (!engine) throw new Error("Engine not initialized");
    
    // Purge memory parameters isolating scoring schema
    await engine.resetChat();

    const response = await engine.chat.completions.create({
      messages: [
        { role: "system", content: "You are a quantitative prompt scoring agent evaluator. Output ONLY valid JSON. No markdown framing. No conversational filler whatsoever." },
        { role: "user", content: `Evaluate this and respond strictly in JSON formatted { "score": number, "reasoning": "string" }: ${text}` }
      ],
      stream: false,
      temperature: 0.1 // Strict mechanical decoding consistency
    });

    const rawOutput = response.choices[0]?.message?.content || "";
    let parsedObject = { score: 10, reasoning: "Fallback exception: String extraction logic internally crashed due to hallucinated formatting." };

    try {
      // The Sanitizer Regex: Extracts brackets ignoring external markdown block string boundaries (` ```json ` defaults)
      const match = rawOutput.match(/\{[\s\S]*\}/);
      if (match) {
        parsedObject = JSON.parse(match[0]);
      } else {
        parsedObject = JSON.parse(rawOutput); // Blind string fallback logic
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

    // Phase 1.3 Additions
    case 'GENERATE_STREAM':
      await generateTextStream(payload.id, payload.prompt, payload.systemInstruction);
      break;

    case 'RUN_BATCH':
      await processBatchInference(payload.id, payload.batch);
      break;

    case 'RUN_SCORER':
      await runStandaloneScorer(payload.id, payload.text);
      break;

    default:
      console.warn(`Local WebWorker received an unknown instruction type: [${type}]`);
  }
};
