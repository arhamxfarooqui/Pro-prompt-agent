# 🧠 Pro Prompt Engine: Architecture, Flows, and Future Roadmap

## 1. Architecture Overview (The "WXT" Choice)

The project uses [WXT](https://wxt.dev) as its foundational framework. WXT is a modern bundler designed specifically for Manifest V3 (MV3) extensions, built on top of Vite. It provides a framework that is "framework-agnostic" at its core but has first-class support for React.

### Why WXT over CRXJS or Native VITE?

- **Stability (The "Pivot")**: Early attempts to use CRXJS with Vite resulted in constant instability in Service Worker termination and HMR (Hot Module Replacement) issues specific to the MV3 lifecycle. WXT was chosen specifically because it abstracts away much of the low-level `manifest.json` complexity and provides a stable API for browser-specific features.
- **Lifecycle Management**: WXT handles the complex lifecycle of the Service Worker (background script) and Offscreen Documents automatically. It ensures that the background script stays "awake" when needed (crucial for AI tasks) and manages the spawning of background pages (like our `offscreen.html`) safely.
- **Production Focus**: WXT builds a production-ready `manifest.json` automatically, supports robust code splitting, and enforces strict environment separation between development and production.

---

## 2. The Data Layer (Why Dexie.js?)

The application handles complex, relational data (User Profiles, Prompt Definitions, Usage Analytics).

### The Choice: [Dexie.js](https://dexie.org/)

Dexie is a wrapper around the native browser `IndexedDB` API.

- **Performance**: It provides synchronous-feeling, promise-based access to the database, making React state management much cleaner than raw IndexedDB callbacks.
- **Complexity Management**: It handles schema migrations, versioning, and transactional integrity automatically, which would be tedious and error-prone to write manually.
- **Caching Strategy**: `lib/cache/cache-manager.ts` uses a custom **LRU (Least Recently Used)** strategy on top of Dexie. This ensures that frequently accessed profiles and snippets load instantly from memory (in-RAM), preventing the UI lag that would occur if every keystroke hit the disk-based IndexedDB.

---

## 3. The AI Core (Flows and Agents)

### 3.1 The Agentic Loop Controller

Central to the application is `lib/agents/loop-controller.ts`. This module orchestrates the "Brain" of the application.

**How it works:**
1.  **Input**: Takes raw user input and the target "Agent Profile" (e.g., "Marketing Copywriter").
2.  **Context Ingestion**:
    -   It retrieves "Profile Guidelines" (How the agent speaks).
    -   It retrieves "Knowledge Context" (Facts and data about the user's business/topic).
    -   It retrieves "Quick Snippets" (Common variables like Product Name, Pricing).
    -   It tokenizes these inputs using `gpt-tokenizer` to ensure they fit within the LLM's context window.
3.  **Iterative Refinement (The Loop)**:
    -   **Scorer**: Calls `lib/agents/scorer.ts` to evaluate the quality of the current prompt (0-100).
    -   **Refactor**: Calls `lib/agents/refactor.ts` to improve the prompt based on the score.
    -   **Generator**: Calls `lib/agents/generator.ts` to produce the final output.
    -   The loop repeats (up to a maximum of 3 iterations) until the score plateaus or the iteration limit is reached.

### 3.2 The Comprehension Agent

Located in `lib/agents/comprehension.ts`, this specialized agent is used for: **Context Extraction**.

- **Use Case**: When a user pastes raw, unstructured text into the "Context Lab", this agent reads it and extracts the key entities (Names, Dates, Locations, Product IDs).
- **Logic**: It uses a highly specific, low-latency prompt (optimized to run fast on local models) to parse the text and return a structured format.

---

## 4. Critical Technical Challenges & Solutions

### Challenge 1: WebGPU Performance in Service Workers

- **Problem**: WebGPU, the low-level graphics API needed for local AI models, cannot run in a standard Web Worker. It requires a full DOM environment.
- **Solution**: **Offscreen Documents**. We use `chrome.offscreen.createDocument` to spin up a hidden HTML page (`entrypoints/offscreen/`) that hosts the WebGPU engine. This is implemented as a **WXT entrypoint** (not a raw HTML file) because WebLLM uses bare module specifiers that must be resolved by the bundler. This allows heavy inference to happen in a dedicated background page without freezing the UI.
- **Edge Case (Background Termination)**: Chromium kills Service Workers after 30 seconds of inactivity. To prevent this, we implemented a **"Ping-Pong" Keep-Alive system** that is **only active when WebGPU is the selected provider** (pinging Groq or Ollama serves no purpose): Content scripts check the active provider before sending messages to the Service Worker, and the Service Worker keeps the Offscreen Document alive. If no tabs are open, the Service Worker uses `chrome.alarms` to periodically wake itself up.
- **CSP Requirement**: The manifest includes `wasm-unsafe-eval` in the Content Security Policy because WebLLM requires WASM execution, which MV3 blocks by default.
- **Default Provider**: The extension defaults to `webgpu` (local-first). Groq cloud is available as a fallback once the user configures an API key.

### Challenge 2: Floating Toolbar Rendering on Dynamic Pages

- **Problem**: The Floating Toolbar needs to appear on top of any webpage (e.g., `chat.openai.com`, `docs.google.com`) without breaking the host site's CSS or Layout.
- **Solution**: **Shadow DOM Injection**. We use WXT's built-in `createShadowRootUi`. This injects our React app into a Shadow Root on the host page. This creates a CSS isolation boundary, ensuring our styles (Tailwind) never conflict with the website's styles.

### Challenge 3: Preventing Token Overload in Context Lab

- **Problem**: Users can paste massive amounts of text into the Context Lab, potentially exceeding the token limit of the LLM and causing `length_limit_exceeded` errors.
- **Solution**: **Strict Token Guardrails** in `lib/cache/cache-manager.ts`.
    -   **Chunking**: Text is split into "Chunky Markdown Nodes".
    -   **FIFO Truncation**: If the total tokens exceed `MAX_CONTEXT_TOKENS` (4000), the system doesn't just cut the text off. It recursively removes the *oldest* nodes (First-In, First-Out) until the entire block fits.

---

## 5. Future Roadmap (The Path to 1.0)

The project is currently in a robust "Beta" state. The following features are planned for the stable release:

1.  **Performance Optimization**: Further caching layers and lazy-loading of the Offscreen Document to reduce cold-start times.
2.  **Advanced Metrics**: Implementing a "Token Budgeting UI" that shows users exactly how much context they are using in real-time.
3.  **Plugin System Expansion**: Developing the "Workflow Builder" to allow users to chain multiple agents together for complex tasks (e.g., Research -> Summarize -> Email Draft).
4.  **Sync Features**: Implementing a sync service (optional) to sync profiles across devices using Google Drive or local file storage.
5.  **Visual Refinement**: Adding more micro-animations and improving the "Dark/Light Mode" contrast for better accessibility.