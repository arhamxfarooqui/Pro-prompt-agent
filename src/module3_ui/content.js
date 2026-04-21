/**
 * src/module3_ui/content.js
 * Content script with Shadow DOM UI.
 * Owns the LLM Web Worker directly (content scripts have full Worker API access).
 * Storage operations go through background.js via chrome.runtime.sendMessage.
 */

import { llmClient } from "../module1_engine/llm-client.js";

(function initAgenticOrchestrator() {
  console.log("[Agentic Orchestrator] Initializing Shadow DOM UI...");

  // ==========================================
  // 1. ISOLATED SHADOW DOM INJECTION
  // ==========================================

  const hostId = "agentic-orchestrator-host";
  if (document.getElementById(hostId)) return;

  const hostElement = document.createElement("div");
  hostElement.id = hostId;
  hostElement.style.position = "absolute";
  hostElement.style.top = "0";
  hostElement.style.left = "0";
  hostElement.style.width = "100%";
  hostElement.style.height = "0";
  hostElement.style.overflow = "visible";
  hostElement.style.zIndex = "2147483647";
  hostElement.style.pointerEvents = "none";

  document.body.appendChild(hostElement);

  const shadow = hostElement.attachShadow({ mode: "open" });

  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("styles.css");
  shadow.appendChild(styleLink);

  const fabWrapper = document.createElement("div");
  fabWrapper.className = "fab-wrapper";
  fabWrapper.style.display = "none";

  fabWrapper.innerHTML = `
    <button class="fab-gear">⚙️</button>
    <button class="fab-button">✨ Refactor</button>
    <button class="fab-score" title="Score Prompt">📊</button>
    <button class="fab-debug" title="Force Debug Recalibration" style="display: none;">🐞</button>
  `;
  shadow.appendChild(fabWrapper);

  const sidebar = document.createElement("div");
  sidebar.className = "context-sidebar";
  sidebar.innerHTML = `
     <h3>🧠 Brain Context</h3>
     <button class="scrape-btn">📄 Read This Page</button>

     <h4>Your Snippets</h4>
     <div class="snippets-container" id="snippetsList"></div>
     <button class="save-snippet-btn" style="margin-top: 5px; width: 100%;">➕ Save Select Text as Snippet</button>

     <h4>Specialist Profile</h4>
     <div class="tags-container" id="tagsContainer">
        <span class="profile-tag" data-tag="Go Backend/Gin">Go Backend/Gin</span>
        <span class="profile-tag" data-tag="C++ Competitive">C++ Competitive (int long long)</span>
        <span class="profile-tag" data-tag="IIITL Student">IIITL Student</span>
     </div>
     <div class="custom-tag-row" style="display: flex; gap: 4px; margin-top: 10px;">
        <input type="text" id="customTagIn" placeholder="Add custom profile..."/>
        <button id="addTagBtn" class="add-tag-btn">➕</button>
     </div>
  `;
  shadow.appendChild(sidebar);

  // ==========================================
  // 2. ELEMENT REFERENCES & STATE
  // ==========================================

  const fabButton = shadow.querySelector('.fab-button');
  const scoreBtn = shadow.querySelector(".fab-score");
  const debugBtn = shadow.querySelector(".fab-debug");
  const gearBtn = shadow.querySelector(".fab-gear");

  const scrapeBtn = shadow.querySelector(".scrape-btn");
  const tagsContainer = shadow.getElementById("tagsContainer");
  const addTagBtn = shadow.getElementById("addTagBtn");
  const customTagIn = shadow.getElementById("customTagIn");

  const snippetsList = shadow.getElementById("snippetsList");
  const saveSnippetBtn = shadow.querySelector(".save-snippet-btn");

  let activeTextNode = null;
  let isSidebarOpen = false;
  let llmInitialized = false;

  // ==========================================
  // 3. LAZY LLM INITIALIZATION
  // ==========================================

  function ensureLLMReady() {
    if (!llmInitialized) {
      llmClient.initialize("gemma-2b-it-q4f16_1-MLC", 2048);
      llmInitialized = true;
    }
  }

  // ==========================================
  // 4. SIDEBAR TOGGLE
  // ==========================================

  gearBtn.addEventListener("click", (e) => {
     e.stopPropagation();
     isSidebarOpen = !isSidebarOpen;
     sidebar.classList.toggle("open", isSidebarOpen);
  });

  // ==========================================
  // 5. PROFILE TAGS
  // ==========================================

  let activeTags = [];

  function bindTagListener(tag) {
     tag.addEventListener("click", () => {
        const tagText = tag.getAttribute("data-tag");
        if (activeTags.includes(tagText)) {
            activeTags = activeTags.filter(t => t !== tagText);
            tag.classList.remove("tag-active");
        } else {
            activeTags.push(tagText);
            tag.classList.add("tag-active");
        }
        chrome.runtime.sendMessage({ type: "SAVE_PROFILE_TAGS", payload: activeTags });
     });
  }

  shadow.querySelectorAll(".profile-tag").forEach(bindTagListener);

  addTagBtn.addEventListener("click", () => {
      const val = customTagIn.value.trim();
      if (!val) return;
      const newTag = document.createElement("span");
      newTag.className = "profile-tag";
      newTag.setAttribute("data-tag", val);
      newTag.textContent = val;
      tagsContainer.appendChild(newTag);
      bindTagListener(newTag);
      customTagIn.value = "";
  });

  // ==========================================
  // 6. SNIPPETS (via background storage)
  // ==========================================

  function loadSnippets() {
      chrome.runtime.sendMessage({ type: "GET_SNIPPETS" }, (res) => {
          if (res && res.success) {
              snippetsList.innerHTML = "";
              res.data.forEach(snip => {
                  const div = document.createElement("div");
                  div.className = "snippet-item";
                  div.textContent = snip.text.length > 25 ? snip.text.substring(0, 25) + "..." : snip.text;
                  div.title = snip.text;
                  div.addEventListener("click", () => {
                      if (!activeTextNode) return;
                      const val = activeTextNode.value;
                      const start = activeTextNode.selectionStart;
                      activeTextNode.value = val.substring(0, start) + snip.text + val.substring(activeTextNode.selectionEnd);
                      activeTextNode.dispatchEvent(new Event('input', { bubbles: true }));
                  });
                  snippetsList.appendChild(div);
              });
          }
      });
  }

  saveSnippetBtn.addEventListener("click", () => {
      if (!activeTextNode) return;
      const text = activeTextNode.value.substring(activeTextNode.selectionStart, activeTextNode.selectionEnd);
      if (!text || text.trim().length === 0) return;

      saveSnippetBtn.textContent = "Saving...";
      chrome.runtime.sendMessage({ type: "SAVE_SNIPPET", payload: text }, () => {
          saveSnippetBtn.textContent = "➕ Save Select Text as Snippet";
          loadSnippets();
      });
  });

  loadSnippets();

  // ==========================================
  // 7. SCORE BUTTON (direct Worker call)
  // ==========================================

  scoreBtn.addEventListener("click", () => {
      if (!activeTextNode) return;
      ensureLLMReady();

      const rawInput = activeTextNode.value;
      const originalText = scoreBtn.textContent;
      scoreBtn.textContent = "⏳";

      llmClient.calculatePromptScore(rawInput)
        .then(result => {
            scoreBtn.textContent = `${result.score}/100`;
            setTimeout(() => { scoreBtn.textContent = originalText; }, 3000);
        })
        .catch(() => {
            scoreBtn.textContent = "ERR";
            setTimeout(() => { scoreBtn.textContent = originalText; }, 2000);
        });
  });

  // ==========================================
  // 8. REFACTOR BUTTON (Worker orchestration)
  // ==========================================

  function runRefactor() {
    if (!activeTextNode) return;
    ensureLLMReady();

    const rawInput = activeTextNode.value;
    fabButton.textContent = "🧠 Routing...";

    // Step 1: Get storage context from background
    chrome.runtime.sendMessage({ type: "GET_STORAGE_CONTEXT" }, (storageRes) => {
      const context = (storageRes && storageRes.success) ? storageRes.data : {};

      // Step 2: Run orchestration directly via Worker
      fabButton.textContent = "🛠️ Agents...";

      llmClient.runOrchestration(rawInput, context)
        .then(finalPrompt => {
            fabButton.textContent = "✨ Refactor";
            debugBtn.style.display = "flex";

            activeTextNode.value = finalPrompt;
            activeTextNode.dispatchEvent(new Event('input', { bubbles: true }));
        })
        .catch(err => {
            console.error("Orchestration failed:", err);
            fabButton.textContent = "✨ Refactor";
        });
    });
  }

  fabButton.addEventListener("click", runRefactor);

  // ==========================================
  // 9. DEBUG BUTTON
  // ==========================================

  debugBtn.addEventListener("click", () => {
      if (!activeTextNode) return;
      ensureLLMReady();

      debugBtn.style.display = "none";
      fabButton.textContent = "🐞 Debugging...";

      const rawInput = activeTextNode.value;

      chrome.runtime.sendMessage({ type: "GET_STORAGE_CONTEXT" }, (storageRes) => {
        const context = (storageRes && storageRes.success) ? storageRes.data : {};

        llmClient.runOrchestration(rawInput, context)
          .then(finalPrompt => {
              fabButton.textContent = "✨ Refactor";
              debugBtn.style.display = "flex";
              activeTextNode.value = finalPrompt;
              activeTextNode.dispatchEvent(new Event('input', { bubbles: true }));
          })
          .catch(() => {
              fabButton.textContent = "✨ Refactor";
          });
      });
  });

  // ==========================================
  // 10. PAGE SCRAPER
  // ==========================================

  scrapeBtn.addEventListener("click", () => {
      scrapeBtn.textContent = "Saving...";
      const text = document.body.innerText
        .replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, "")
        .replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, "")
        .trim()
        .substring(0, 2500);

      chrome.runtime.sendMessage({ type: "SAVE_SCRAPED_CONTEXT", payload: text }, () => {
          scrapeBtn.textContent = "✅ Saved!";
          setTimeout(() => scrapeBtn.textContent = "📄 Read This Page", 2000);
      });
  });

  // ==========================================
  // 11. AUTOCOMPLETE STREAM (direct Worker)
  // ==========================================

  // Autocomplete is handled by autocomplete-ui.js via port connection
  // But now it goes directly through our Worker instead of through background

  // ==========================================
  // 12. DOM TRACKING & FAB POSITIONING
  // ==========================================

  document.addEventListener("focusin", handleFocus);
  document.addEventListener("input", handleInput);
  document.addEventListener("click", handleClickGlobal);

  document.addEventListener("scroll", updateFabPosition, { passive: true, capture: true });
  window.addEventListener("resize", updateFabPosition, { passive: true });

  function isValidInputField(target) {
    if (!target) return false;
    const tagName = target.tagName ? target.tagName.toLowerCase() : "";
    return tagName === "textarea" || target.isContentEditable;
  }

  function handleFocus(event) {
    if (isValidInputField(event.target)) {
      activeTextNode = event.target;
      updateFabPosition();
      fabWrapper.style.display = "block";
    }
  }

  function handleInput(event) {
    if (isValidInputField(event.target)) {
      activeTextNode = event.target;
      updateFabPosition();
      fabWrapper.style.display = "block";
    }
  }

  function updateFabPosition() {
    if (!activeTextNode) return;

    const rect = activeTextNode.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      fabWrapper.style.display = "none";
      return;
    }

    const offsetBottom = 16;
    const offsetRight = 16;
    const fabPredictedHeight = 40;
    const fabPredictedWidth = 120;

    const absoluteTop = window.scrollY + rect.bottom - offsetBottom - fabPredictedHeight;
    const absoluteLeft = window.scrollX + rect.right - offsetRight - fabPredictedWidth;

    fabWrapper.style.top = `${absoluteTop}px`;
    fabWrapper.style.left = `${absoluteLeft}px`;
  }

  function handleClickGlobal(event) {
    if (!activeTextNode) return;

    const clickedInsideInput = activeTextNode.contains(event.target);
    const clickedInsideShadowRoot = event.composedPath().includes(hostElement);

    if (!clickedInsideInput && !clickedInsideShadowRoot) {
      activeTextNode = null;
      fabWrapper.style.display = "none";
    }
  }

})();
