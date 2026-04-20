/**
 * src/module1_engine/llm-client.js
 * The Singleton Main Thread Bridge.
 * Abstracts asynchronous Web Worker interfaces into clean, unblocking UI Promise wrappers.
 */

class LLMClientBridge {
  constructor() {
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    
    // Internal state mapping requests to their Promise resolution vectors securely
    this.pendingRequests = new Map();
    this.streamCallbacks = new Map();

    this.worker.onmessage = this._handleWorkerMessage.bind(this);
  }

  /**
   * Internal monolithic message dispatcher loop.
   */
  _handleWorkerMessage(event) {
    const { type, id, data, error, status, message, isWebGPU } = event.data;

    // Bootstrap diagnostic piping
    if (type === 'INIT_PROGRESS' || type === 'INIT_STATUS') {
      console.log(`[LLM Inference] ${type}:`, data || status || message);
      return;
    }
    
    if (type === 'INIT_COMPLETE') {
      console.log(`[LLM Inference] Hardware Core Thread Started. Hardware WebGPU Validation: ${isWebGPU}`);
      return;
    }

    // Direct resolution vector matching via UUIDs
    if (!id) return; 

    // Stream Autocomplete Pipeline Interface
    if (type === 'STREAM_TOKEN') {
      const callback = this.streamCallbacks.get(id);
      if (callback) callback(data);
      return;
    }

    if (type === 'STREAM_COMPLETE') {
      const handler = this.pendingRequests.get(id);
      if (handler) handler.resolve(true); 
      this.streamCallbacks.delete(id);
      this.pendingRequests.delete(id);
      return;
    }

    if (type === 'STREAM_ERROR') {
      const handler = this.pendingRequests.get(id);
      if (handler) handler.reject(new Error(error));
      this.streamCallbacks.delete(id);
      this.pendingRequests.delete(id);
      return;
    }

    // Pure Promise API Mapping Queue
    const handler = this.pendingRequests.get(id);
    if (!handler) {
      console.warn(`Thread Bridge desynchronized tracking UUID map: ${id}`);
      return;
    }

    // Dynamic error tracking resolving via suffix matching
    if (type.endsWith('_ERROR')) {
      handler.reject(new Error(error));
    } else {
      handler.resolve(data);
    }

    // Memory garbage cleanup avoiding request bloat Map structures
    this.pendingRequests.delete(id);
  }

  /**
   * Cryptographically insecure UUID generator exclusively serving mapping dictionaries fast. 
   */
  _generateId() {
    return 'req_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  }

  /**
   * Commandeers the Thread context booting the raw Gemma-4 quantized node internally.
   * 
   * @param {string} [modelName="gemma-2b-it-q4f16_1-MLC"] 
   * @param {number} [capVRAM=2048] 
   */
  initialize(modelName = "gemma-2b-it-q4f16_1-MLC", capVRAM = 2048) {
    this.worker.postMessage({
      type: 'INIT_ENGINE',
      payload: { modelName, capVRAM }
    });
  }

  /**
   * High performance pipeline ensuring <400ms UI interaction bindings asynchronously.
   * 
   * @param {string} text - Typed string memory snapshot
   * @param {function} onToken - Iterator executed physically passing char delta updates per frame
   * @returns {Promise<boolean>} Block completion flag
   */
  streamAutocomplete(text, onToken) {
    return new Promise((resolve, reject) => {
      const id = this._generateId();
      this.pendingRequests.set(id, { resolve, reject });
      this.streamCallbacks.set(id, onToken);

      this.worker.postMessage({
        type: 'GENERATE_STREAM',
        payload: { id, prompt: text }
      });
    });
  }

  /**
   * Submits full structural batches sequentially limiting local WebLLM out of memory bounds dynamically.
   * 
   * @param {Array<{agentId: string, prompt: string}>} agents 
   * @returns {Promise<Array<{agentId: string, result: string}>>} Resolved agent structural mapping
   */
  runAgentBatch(agents) {
    return new Promise((resolve, reject) => {
      const id = this._generateId();
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({
        type: 'RUN_BATCH',
        payload: { id, batch: agents }
      });
    });
  }

  /**
   * Bypasses iterative logic manually enforcing single payload response constraints (JSON strict wrapper checks).
   * 
   * @param {string} text - LLM payload
   * @returns {Promise<{score: number, reasoning: string}>} Verified Object Output 
   */
  calculatePromptScore(text) {
    return new Promise((resolve, reject) => {
      const id = this._generateId();
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({
        type: 'RUN_SCORER',
        payload: { id, text }
      });
    });
  }
}

export const llmClient = new LLMClientBridge();
