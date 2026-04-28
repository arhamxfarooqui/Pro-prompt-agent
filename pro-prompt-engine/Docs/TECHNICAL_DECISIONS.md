# Pro Prompt Engine — Technical Decisions & Architecture Justification

This document serves as the primary artifact for explaining the *why* behind the architecture of the Pro Prompt Engine. It covers all edge cases, flow behaviors, and architectural pivots made during development to ensure long-term maintainability for Manifest V3 (MV3) Chrome Extensions.

---

## 1. FrameWork Pivot: CRXJS to WXT

### **Alternative Considered:** CRXJS + Vite
Initially, the project was scaffolded with CRXJS. CRXJS is popular for bridging Vite with Chrome Extensions by watching file changes and reloading the extension.

### **The Choice: WXT (`wxt.dev`)**
**Reasoning:**
- **MV3 Stability:** CRXJS frequently suffers from Service Worker termination issues and complex HMR (Hot Module Replacement) bugs in Manifest V3. 
- **File-Based Routing:** WXT provides a Nuxt-like `entrypoints/` system. Instead of manually maintaining `manifest.json` and injecting React roots via complex scripts, WXT auto-generates the manifest based on the file structure (e.g., `entrypoints/background.ts`, `entrypoints/popup/`).
- **Shadow DOM Native:** WXT natively exports `createShadowRootUi`, which is mission-critical for our Floating Toolbar.

---

## 2. WebGPU vs Service Worker Limitations

### **The Problem:**
Manifest V3 imposes a harsh 30-second termination limit on Service Workers. If a Service Worker idles for 30s, Chromium kills it. For heavy WebGPU models (`@mlc-ai/web-llm`), loading models into VRAM takes 5-10 seconds. If the SW dies, the model leaves VRAM, resulting in massive latency for the user.

### **Alternative Considered:** Native Messaging App
Running a local Python backend and connecting via Chrome Native Messaging. *Rejected because it violates the "local-first, browser-only, zero-install" functional requirement.*

### **The Choice: Bidirectional Keep-Alive + Offscreen Document**
**Reasoning:**
1. **Offscreen API:** WebGPU inference cannot easily run inside a Service Worker due to strict API limits. It must run in a background HTML page. We use `chrome.offscreen.createDocument` (`public/offscreen.html`) to host the WebGPU context securely.
2. **Ping-Pong Heartbeat:** To keep both the SW and Offscreen alive, we implemented a bidirectional system:
   - `setInterval` in Content Scripts fires a `KEEP_ALIVE_PING` every 20 seconds. 
   - Since the Content Script is attached to an active tab, Chromium respects its ping and refuses to shut down the Service Worker.
3. **Edge Case Covered:** If the user has *no* tabs open, the SW uses `chrome.alarms` to artificially trigger a wakeup every 24 seconds to ping the Offscreen Document.

---

## 3. Data Layer: Dexie.js + Active LRU Cache

### **Alternative Considered:** `localStorage` or pure `chrome.storage.local`
*Rejected because:* 
- `localStorage` is completely disabled in MV3 Service Workers.
- `chrome.storage.local` is async. When React needs to render a library of 50 prompts, awaiting asynchronous bridge calls causes noticeable UI stutter.

### **The Choice: IndexedDB (via Dexie) + O(1) LRU Cache**
**Reasoning:**
1. **Dexie.js:** Provides robust, transactional storage for relational data (Profiles, Prompts, Snippets).
2. **LRU Cache Map (`lib/cache/lru-cache.ts`):** Wraps Dexie. When the extension boots, `background.ts` calls `cacheManager.warmUp()`, loading active configurations entirely into memory.
3. **Synchronous Speed:** When the UI requests standard configuration data, it resolves instantly from the LRU map.

---

## 4. Token Truncation logic (FIFO strategy)

### **The Problem:**
LLMs fail severely if the Context Window is exceeded. Users will paste entire documents into the "Context Lab". Handing raw text to WebGPU or Groq will cause `length_limit_exceeded` errors.

### **Alternative Considered:** Simple Character Limit (e.g., 20,000 chars)
*Rejected because:* Muli-lingual tokens and code formatting can drastically alter token counts, causing uncatchable API errors.

### **The Choice: `gpt-tokenizer` + Readability**
**Reasoning:**
- We embedded `gpt-tokenizer`, which provides true BPE (Byte-Pair Encoding) counting matching GPT/Llama tokenization engines.
- `cache-manager.ts` strictly enforces a `MAX_CONTEXT_TOKENS = 4000`. 
- **Edge Case (Context Overflow):** If a user feeds 5000 tokens, the system gracefully processes it via a **FIFO** strategy: the oldest nodes in `Context.md` are truncated recursively until the whole block fits under 4000 tokens safely.

---

## 5. UI Architecture: Shadow DOM for Toolbar

### **The Problem:**
If we inject standard Tailwind CSS into ChatGPT (`chat.openai.com`), our CSS class `.text-blue-500` might overwrite ChatGPT's CSS, breaking their site—or vice versa.

### **Alternative Considered:** Iframe Injection
*Rejected because:* Iframes are slow to boot React, cannot easily capture keyboard events originating on the parent frame (e.g., for Autocomplete), and make coordinate mapping overly complex.

### **The Choice: WXT `createShadowRootUi`**
**Reasoning:**
- The Shadow Root provides CSS complete isolation boundaries natively at the browser level.
- Our Tailwind tokens are compiled into `main.css` and injected *only* within the shadow boundary inside the target page. 

---

## 6. The ML Agentic Loop Controller

### **The Choice: Deterministic Refactor Loops**
To ensure high-quality prompt output, we implemented an autonomous sequence (`lib/agents/loop-controller.ts`). 
- **The Flow:**
  1. The **Refactor Agent** rebuilds the prompt.
  2. The **Scorer Agent** evaluates it linearly (1-100).
  3. If `Score < 85`, the loop repeats natively up to `MAX_ITERATIONS` (3).
- **Edge Case Coverage:**
  - What if the Scorer hallucinates standard text instead of the requested JSON score schema?
  - *Mitigation:* We use a `try/catch` and a fallback Regex pattern (`/(?:"?score"?\s*:\s*)?(\d+)/i`) to forcibly extract any numeric score the model spits out before failing. 
