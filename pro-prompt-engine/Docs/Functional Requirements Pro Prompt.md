# **Functional Requirements Document (FRD): Dynamic Agentic Prompt Engine**

## **1. Architecture Context**

This specification defines a flexible execution environment for a prompt engineering assistant. It supports a hybrid model execution strategy, allowing for zero-install, local-first inference (via WebGPU/browser-native LLMs), local runners (e.g., Ollama), and external high-speed APIs (e.g., Groq). The system employs an Agentic Loop topology utilizing an in-memory LRU cache for high-speed profile caching and persistent local storage (IndexedDB via Dexie.js) for context management. The entire extension is built using the **WXT Framework (`wxt.dev`)** with React and Tailwind CSS for robust Manifest V3 compatibility.

### **Tackling WebGPU Memory Eviction & Latency**

To prevent the local model from going "cold" and causing massive load times on subsequent requests, the system utilizes a multi-layered approach combining heartbeat mechanics and hybrid fallback routing.

#### **1. Offscreen Document API**
The keep-alive architecture relies on the **Offscreen Document API**. An Offscreen Document maintains a standard JavaScript `setInterval` or an active WebRTC/Audio context to prevent suspension, acting as the true anchor for the WebGPU instance, while keeping the Service Worker lightweight.

#### **2. Service Worker Lifecycle Management (Bidirectional Pinging)**
Manifest V3 Service Workers sleep after 30 seconds of inactivity, which unloads the LLM from VRAM. 
* **Implementation:** Establish a bidirectional ping system. The `content-script` and `service-worker` must ping each other every 15-20 seconds to guarantee the Service Worker stays awake. This operates alongside `chrome.alarms` to ensure maximum uptime.

#### **3. Hybrid Routing (The "Warm-Up" Fallback)**
Even with heartbeats, the OS might forcefully reclaim VRAM. This routing hides loading times from the user.
* **Implementation:** When the user initiates an action, the system checks the WebGPU context state.  
* **Action:** If WebGPU is *cold* (unloaded), immediately route the request to a fast external API fallback (e.g., Groq) for an instant response. Simultaneously, trigger an asynchronous background load for the WebGPU model.  
* **Result:** The user never experiences the model load time. By their next request, the local model is hot and takes over.

---

## **2. Comprehensive UI/UX Architecture**

The application operates across three distinct user interface layers.

### **2.1. The Extension PopUp (Remote Control)**

**Description:** The primary quick-access menu triggered by clicking the extension icon. It acts as a "remote control" for the active browser tab rather than a standalone text-entry app.

* **Layout:** A vertical, compact card interface.  
* **Core Elements:** * **Header:** Active Model status indicator, Score gauge, and a quick link to download models/settings.  
  * **Profile Selector:** A 3x2 visual grid of circular icons representing available profiles (e.g., Developer, Analyst) to quickly swap active personas.  
  * **Action Buttons:** Simple triggers that act upon the active webpage's input field: "Refactor Active Input", "Generate Prompt", and "Add Snippet". 
  * **Quick Toggles:** Switches for "Autocomplete" and "Select-to-Context". 

### **2.2. The Injected Floating Toolbar (Contextual Companion)**

**Description:** A vertical, floatable feature bar injected directly into the DOM of target LLM web pages (e.g., ChatGPT, Gemini, Claude).

* **Layout:** Positioned on the Right-Hand Side (RHS) of the screen. Wrapped in a **Shadow DOM** to prevent CSS leakage from host pages.
* **Behavior:** * **Draggable:** Can be repositioned along the vertical axis.  
  * **Collapsible:** Defaults to expanded state, but collapses into a minimalist icon-only pill or hides entirely.  
  * **Shadow DOM Modals:** Clicking actions (like "Generate Prompt" or "Add Snippet") dims the screen inside the shadow root and displays React modals *directly over the webpage* rather than opening the extension popup.
* **Core Elements (Icon Actions):** * *Generate Score:* Reads the active textarea via Shadow DOM piercing and returns a score.  
  * *Refactor:* Triggers the multi-agent loop on the active text.  
  * *Enable Autocomplete:* Toggles inline ghost-text predictions.  
  * *Generate Prompt:* Opens an inline modal to input instructions.  
  * *Scan Webpage:* Parses the current page to feed context.  
  * *Select Text (ACV):* Highlights text and surfaces a tooltip to push it into a profile's context.  
  * *Add Snippet:* Opens an inline modal to save a text fragment.  
* **Injection Logic:** Utilizes `MutationObserver` with logic for *Shadow DOM piercing*. Standard `MutationObserver` events do not bubble up across Shadow DOM boundaries, requiring dedicated event listeners attached directly to the shadow roots of the target text areas.

### **2.3. The Dedicated Web Dashboard (Options Page)**

**Description:** A full-page, standalone React application built as a standard WXT Options Page (forced `open_in_tab: true` so it opens as a full tab, not an embedded modal). 

* **Layout:** Standard SaaS layout with a persistent left-hand sidebar.  
* **Sidebar Navigation & Features:** * **Dashboard:** High-level overview and recent activity.  
  * **Prompt Library:** Saved, finalized prompts categorized by use case.  
  * **Analytics:** Visual tracking using `recharts` for Total Tokens Used, Avg. Response Score, Active Prompts, and Model usage metrics.  
  * **Snippets Management:** A detailed data table (Prefix Trigger, Description, Body Preview, Actions) to Create, Read, Update, and Delete (CRUD). Includes an "Edit" button.
  * **Context Hub (Profiles):** The core management area. Displays profile cards. Each profile now strictly contains **FOUR** markdown files: `Context.md`, `PromptGuidelines.md`, `ProfileDescription.md`, and **`ScoringGuidelines.md`**.  
  * **Settings & Model Management:** Area to manage API keys and a dedicated UI for WebGPU models. Features a grid of downloadable models (e.g., `gemma-2b-it-q4f32_1-MLC`) with VRAM requirements. Utilizes `@mlc-ai/web-llm`'s `initProgressCallback` to display a real-time progress bar and percentage during download.

---

## **3. Core Feature Specifications & Execution Flows**

### **3.1. On-Demand Prompt Scoring**

* **Description:** An independent Scorer Agent that generates a deterministic quality score (0-100).  
* **Trigger:** Explicit user action (Popup or Floating Toolbar).  
* **Execution Flow:** 1. System reads the raw text from the active input area.  
  2. Text is sent to the Scorer Agent. **Crucial:** The Scorer utilizes a high `max_tokens` limit (e.g., 500) to prevent truncation, and uses **Few-Shot Prompting** to enforce strict JSON formatting from smaller local models.
  3. **Robust Extraction:** The Agent uses Regex (e.g., `match(/\{[\s\S]*\}/)`) and self-healing logic to extract the JSON object, preventing crashes. A safe fallback `{ score: 50, critique: "Fallback..." }` is returned if parsing totally fails.
  4. The UI displays the score and visual nudges for refactoring.

### **3.2. Context Feeding Pipeline (Three-Pronged Ingestion)**

To ensure the LLM retains strict persona boundaries, context feeding is managed across three distinct methods. All process data through a "Comprehension Agent" before saving.

* **Method A: Manual Text Entry** * **Execution:** User selects "Target Profile" and pastes text. The Comprehension Agent formats/summarizes it and appends it to `Context.md`.  
* **Method B: Contextual Text Selection** * **Execution:** User highlights text on any webpage. A tooltip "Feed to Profile" appears. Selected text is instantly appended.  
* **Method C: Full Webpage Scan** * **Execution:** Integrates Mozilla's `@mozilla/readability` engine. This engine extracts the main article text and preserves code blocks (ignoring raw DOM noise, ads, and navbars). The extracted text is passed to the Comprehension Agent, summarized, and appended to `Context.md`.
* **Context Pruning:** Utilizes `gpt-tokenizer` to enforce a strict token limit (e.g., 4000 tokens) on `Context.md`. A background job runs a "Summarize the Summaries" prompt or FIFO rolling window if the limit is breached.
* **State Synchronization:** Uses `BroadcastChannel API` or `chrome.storage.onChanged` to instantly sync profile/snippet changes across all open browser tabs.

### **3.3. Prompt Refactor Engine (The Multi-Agent Loop)**

**Goal:** Transform a weak prompt into a structured, persona-driven prompt using a self-correcting loop.

* **Execution Flow:** 1. **Refactor Agent (Call 1):** Constructs a system prompt from Profile Guidelines + Context. Injects the raw prompt.  
  2. **Scorer Agent (Call 2):** Evaluates output against `ScoringGuidelines.md`.
  3. **Evaluation Gate:** If score >= 75, display diff-viewer. If score < 75, proceed to Iteration 2.  
  4. **Refactor Agent (Call 3):** Receives Version 1 *plus* the Scorer's critique.  
  5. *Circuit Breaker:* Loop is hard-capped at 2 or 3 iterations to prevent infinite latency.

### **3.4. "Write a Prompt for Me" (Prompt Generator)**

* **Execution Flow:** A Shadow DOM modal opens. User types a short description, selects a Profile, and adjusts a "Detail Level" slider. The Generator Agent drafts the prompt, evaluates it via the loop, and outputs a preview for insertion.

### **3.5. Dynamic Variable Resolution (/ Snippets)**

**Goal:** Instantly inject saved context without LLM latency.

* **Trigger:** Keydown listener detects the `/` character (changed from `@` to prevent native AI platform conflicts).  
* **UI Flow:** A floating popover menu appears at cursor coordinates, filtering IndexedDB results real-time. Snippet creation auto-prepends the `/` prefix. 
* **Execution Flow:** User selects via arrow keys/mouse -> textarea value is sliced -> Body text inserted -> cursor repositioned.

### **3.6. Inline Prompt Autocomplete (Sub-Second Execution)**

* **Execution Flow:** 400ms debounce typing listener grabs the last ~150 words. Sent to active LLM (Groq or hot WebGPU) with `max_tokens: 30`. 
* **DOM Manipulation:** Overlays a transparent ghost text `<span>`. Accepted via `Tab`.
* **Network Throttling:** Implements `AbortController`. New keystrokes immediately abort pending fetch requests to prevent race conditions and stuttering.
* **PII Scrubbing:** Local Regex pipeline specifically targets and masks IPv4/IPv6 addresses, email addresses, API key formats (`sk-[a-zA-Z0-9]+`), and credit card patterns *before* routing to external endpoints.

---

## **4. Implementation Roadmap & Technical Checklist**

**Phase 1: Foundation & WXT Migration**
* [ ] Migrate to WXT framework (`wxt.dev`) with React/Tailwind. Ensure `entrypoints` structure.
* [ ] Configure `wxt.config.ts` for full-tab Options page (`open_in_tab: true`) and inject `web_accessible_resources` for CSS.
* [ ] Build LLM connection adapters (Ollama, Groq, WebGPU) with fallback routing.
* [ ] Define Manifest Permissions: `storage`, `activeTab`, `scripting`, `offscreen`, `alarms`, and `host_permissions`.
* [ ] Implement Bidirectional Pinging (15-20s interval) between Content Script and Service Worker to bypass 30s death.

**Phase 2: UI Surfaces Development**
* [ ] Build the "Remote Control" Extension PopUp.
* [ ] Develop the Injected Floating Toolbar inside a **Shadow DOM**. Attach MutationObservers with Shadow DOM piercing.
* [ ] Build the WXT Options Page (Dashboard) with React Sidebar routing, Context Hub, and Snippets data table (with Edit capability).
* [ ] Implement WebLLM Model Downloader in Settings featuring `initProgressCallback` for visual progress bars on Gemma/Llama models.

**Phase 3: Profiles, Caching & Context**
* [ ] Establish Dexie.js architecture for Profiles, Snippets, and History.
* [ ] Implement the **4-file system** (`Context.md`, `PromptGuidelines.md`, `ProfileDescription.md`, `ScoringGuidelines.md`).
* [ ] Integrate local LRU memory cache with write-through to Dexie.
* [ ] Build Context Feeding pipelines using `@mozilla/readability` for Web Scans.
* [ ] Integrate `gpt-tokenizer` to enforce 4000-token limit on `Context.md`.

**Phase 4: Agentic Logic & Refinement**
* [ ] Develop Core Agents (Refactor, Generator, Scorer, Comprehension) using vanilla TypeScript loops.
* [ ] Implement Robust JSON parsing for Scorer Agent (Regex extraction + Few-Shot prompt + 500 max_token limit).
* [ ] Build the `/` Snippet trigger listener and inline dropdown menu.
* [ ] Implement `AbortController` ghost-text Autocomplete and Regex PII/Secret scrubbing.
* [ ] Integrate `recharts` for the Analytics Dashboard view.