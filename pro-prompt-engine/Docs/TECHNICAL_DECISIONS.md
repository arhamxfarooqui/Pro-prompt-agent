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

---

## 7. Offscreen Document as WXT Entrypoint (Bundled)

### **The Problem:**
The offscreen document hosts WebLLM (`@mlc-ai/web-llm`) for in-browser GPU inference. Initially, this was a raw HTML file (`public/offscreen.html`) with an inline `<script type="module">` using `import { CreateMLCEngine } from '@mlc-ai/web-llm'`.

### **Why it broke:**
Browsers **cannot resolve bare module specifiers** (like `@mlc-ai/web-llm`) without a bundler. Only tools like Vite/Webpack/Rollup can map `@mlc-ai/web-llm` → `node_modules/@mlc-ai/web-llm/...`. A raw `<script type="module">` in an HTML file tries to fetch the string `@mlc-ai/web-llm` as a URL, which fails silently. The entire WebGPU pipeline was dead — no model ever loaded, state was always `cold`, and every LLM feature fell through to the Groq fallback.

### **The Fix: WXT Entrypoint**
The offscreen document is now `entrypoints/offscreen/index.html` + `entrypoints/offscreen/main.ts`. WXT recognizes this as an entrypoint and bundles it with Vite, properly resolving all bare specifiers. The compiled output is a working `offscreen.html` at the extension root.

**Key lesson:** Any HTML page in a Chrome extension that needs to `import` from `node_modules` must be processed by the bundler — it cannot live in `public/` as a raw file.

---

## 8. CSP `wasm-unsafe-eval` Requirement

### **The Problem:**
Manifest V3's default Content Security Policy blocks WebAssembly execution. WebLLM uses WASM modules internally for GPU shader compilation and tensor operations.

### **The Fix:**
Added `content_security_policy.extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"` to the manifest. This matches the Gray Matter extension's CSP configuration. The `wasm-unsafe-eval` directive specifically allows WASM compilation without opening up full `unsafe-eval` (which would be a security risk).

---

## 9. Conditional Keep-Alive (WebGPU-only)

### **The Problem:**
The bidirectional keep-alive system (Content Script → Service Worker pings, SW → Tab heartbeats, Alarm-based offscreen checks) was firing unconditionally regardless of which LLM provider was active. This meant:
- Pinging Groq Cloud every 20 seconds — pointless, Groq is stateless.
- Pinging Ollama every 20 seconds — pointless, Ollama manages its own lifecycle.
- Creating/maintaining the offscreen document when WebGPU wasn't even in use.

### **The Fix:**
Both the Content Script ping interval and the Service Worker heartbeat now check `chrome.storage.local.activeProvider` before each tick. If the provider is not `webgpu`, the ping is skipped. The `sw-keepalive` alarm still fires (keeping the SW alive for all providers), but `ensureOffscreen()` is only called when WebGPU is active.

---

## 10. Default Provider: WebGPU (Local-First)

### **The Problem:**
The extension defaulted to `groq` as the active provider. On fresh installs with no API key configured, *every* inference request failed because Groq requires authentication. This made the extension appear completely non-functional.

### **The Fix:**
Default provider changed to `webgpu` in all locations: `llm-router.ts`, `popup/App.tsx`, and `options/App.tsx`. The extension is designed as a local-first tool — WebGPU should be the primary provider, with Groq as a cloud fallback after the user explicitly configures an API key.
