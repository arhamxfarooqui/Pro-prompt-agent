/**
 * content.js — Plain JS content script (NO ES module imports).
 * ALL operations go through chrome.runtime.sendMessage to background.
 * Supports both <textarea> and contentEditable elements.
 */
(function initAgenticOrchestrator() {
  "use strict";
  console.log("[Agentic Orchestrator] Content script loaded.");

  // ==========================================
  // 0. CONTENT EDITABLE HELPERS
  // ==========================================
  function getText(el) {
    if (!el) return "";
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") return el.value || "";
    if (el.isContentEditable) return el.innerText || el.textContent || "";
    return el.value || el.textContent || "";
  }

  function setText(el, text) {
    if (!el) return;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") {
      el.value = text;
    } else if (el.isContentEditable) {
      el.focus();
      // Use execCommand for React/Vue compatibility on contentEditable
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ==========================================
  // 1. SHADOW DOM INJECTION
  // ==========================================
  var hostId = "agentic-orchestrator-host";
  if (document.getElementById(hostId)) return;

  var hostElement = document.createElement("div");
  hostElement.id = hostId;
  hostElement.style.cssText = "position:absolute;top:0;left:0;width:100%;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
  document.body.appendChild(hostElement);

  var shadow = hostElement.attachShadow({ mode: "open" });

  var styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("styles.css");
  shadow.appendChild(styleLink);

  var fabWrapper = document.createElement("div");
  fabWrapper.className = "fab-wrapper";
  fabWrapper.style.display = "none";
  fabWrapper.innerHTML =
    '<button class="fab-gear">⚙️</button>' +
    '<button class="fab-button">✨ Refactor</button>' +
    '<button class="fab-score" title="Score Prompt">📊</button>' +
    '<button class="fab-debug" title="Force Debug" style="display:none;">🐞</button>';
  shadow.appendChild(fabWrapper);

  var sidebar = document.createElement("div");
  sidebar.className = "context-sidebar";
  sidebar.innerHTML =
    '<h3>🧠 Brain Context</h3>' +
    '<button class="scrape-btn">📄 Read This Page</button>' +
    '<div class="status-msg" style="font-size:11px;color:#9ca3af;margin:6px 0;min-height:14px;"></div>' +
    '<h4>Your Snippets</h4>' +
    '<div class="snippets-container" id="snippetsList"></div>' +
    '<button class="save-snippet-btn" style="margin-top:5px;width:100%;">➕ Save Selected Text</button>' +
    '<h4>Specialist Profile</h4>' +
    '<div class="tags-container" id="tagsContainer">' +
      '<span class="profile-tag" data-tag="Go Backend/Gin">Go Backend/Gin</span>' +
      '<span class="profile-tag" data-tag="C++ Competitive">C++ Competitive</span>' +
      '<span class="profile-tag" data-tag="IIITL Student">IIITL Student</span>' +
    '</div>' +
    '<div style="display:flex;gap:4px;margin-top:10px;">' +
      '<input type="text" id="customTagIn" placeholder="Add custom tag..."/>' +
      '<button id="addTagBtn" class="add-tag-btn">➕</button>' +
    '</div>';
  shadow.appendChild(sidebar);

  // ==========================================
  // 1.5 LLM DOWNLOAD PROGRESS OVERLAY
  // ==========================================
  var downloadOverlay = document.createElement("div");
  downloadOverlay.className = "llm-download-overlay";
  downloadOverlay.style.cssText = [
    "position:fixed", "bottom:24px", "right:24px", "z-index:2147483647",
    "width:340px", "padding:16px 20px", "border-radius:16px",
    "background:rgba(15,15,25,0.92)", "backdrop-filter:blur(20px)",
    "border:1px solid rgba(139,92,246,0.3)",
    "box-shadow:0 8px 32px rgba(0,0,0,0.4),0 0 60px rgba(139,92,246,0.1)",
    "font-family:'Inter','Segoe UI',system-ui,sans-serif",
    "color:#e2e8f0", "pointer-events:auto", "display:none",
    "transition:all 0.4s cubic-bezier(0.16,1,0.3,1)",
    "transform:translateY(10px)", "opacity:0"
  ].join(";");
  downloadOverlay.innerHTML =
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
      '<div style="font-size:22px;line-height:1;">🧠</div>' +
      '<div>' +
        '<div style="font-weight:600;font-size:13px;color:#c4b5fd;">Local LLM Engine</div>' +
        '<div class="dl-status" style="font-size:11px;color:#94a3b8;margin-top:2px;">Preparing download...</div>' +
      '</div>' +
    '</div>' +
    '<div style="background:rgba(255,255,255,0.08);border-radius:8px;height:6px;overflow:hidden;">' +
      '<div class="dl-bar" style="height:100%;width:0%;border-radius:8px;' +
        'background:linear-gradient(90deg,#8b5cf6,#6366f1,#818cf8);' +
        'transition:width 0.3s ease;"></div>' +
    '</div>' +
    '<div class="dl-detail" style="font-size:10px;color:#64748b;margin-top:6px;text-align:right;">0%</div>';
  shadow.appendChild(downloadOverlay);

  var dlBar = downloadOverlay.querySelector(".dl-bar");
  var dlStatus = downloadOverlay.querySelector(".dl-status");
  var dlDetail = downloadOverlay.querySelector(".dl-detail");
  var downloadShown = false;

  function showDownloadOverlay() {
    if (downloadShown) return;
    downloadShown = true;
    downloadOverlay.style.display = "block";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        downloadOverlay.style.transform = "translateY(0)";
        downloadOverlay.style.opacity = "1";
      });
    });
  }

  function hideDownloadOverlay() {
    downloadOverlay.style.transform = "translateY(10px)";
    downloadOverlay.style.opacity = "0";
    setTimeout(function () {
      downloadOverlay.style.display = "none";
      downloadShown = false;
    }, 400);
  }

  function updateDownloadProgress(progress) {
    showDownloadOverlay();
    if (!progress) return;

    var text = progress.text || progress.progress || "";
    if (typeof text === "string") {
      dlStatus.textContent = text.length > 60 ? text.substring(0, 60) + "..." : text;
    }

    // Try to extract percentage from progress text or object
    var pct = 0;
    if (typeof progress.progress === "number") {
      pct = Math.round(progress.progress * 100);
    } else if (typeof text === "string") {
      var match = text.match(/(\d+\.?\d*)\s*%/);
      if (match) pct = Math.round(parseFloat(match[1]));
      // Also try "X/Y" pattern
      var fracMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (fracMatch && !match) {
        pct = Math.round((parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100);
      }
    }

    if (pct > 0) {
      dlBar.style.width = Math.min(pct, 100) + "%";
      dlDetail.textContent = Math.min(pct, 100) + "%";
    }
  }

  // ==========================================
  // 2. ELEMENT REFERENCES
  // ==========================================
  var fabButton = shadow.querySelector(".fab-button");
  var scoreBtn = shadow.querySelector(".fab-score");
  var debugBtn = shadow.querySelector(".fab-debug");
  var gearBtn = shadow.querySelector(".fab-gear");
  var scrapeBtn = shadow.querySelector(".scrape-btn");
  var statusMsg = shadow.querySelector(".status-msg");
  var tagsContainer = shadow.getElementById("tagsContainer");
  var addTagBtn = shadow.getElementById("addTagBtn");
  var customTagIn = shadow.getElementById("customTagIn");
  var snippetsList = shadow.getElementById("snippetsList");
  var saveSnippetBtn = shadow.querySelector(".save-snippet-btn");

  var activeTextNode = null;
  var isSidebarOpen = false;

  function setStatus(msg) {
    if (statusMsg) statusMsg.textContent = msg;
    console.log("[Agentic]", msg);
  }

  // ==========================================
  // 3. SIDEBAR
  // ==========================================
  gearBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    isSidebarOpen = !isSidebarOpen;
    sidebar.classList.toggle("open", isSidebarOpen);
    setStatus(isSidebarOpen ? "Sidebar opened" : "Sidebar closed");
  });

  // ==========================================
  // 4. PROFILE TAGS
  // ==========================================
  var activeTags = [];

  function bindTagListener(tag) {
    tag.addEventListener("click", function () {
      var tagText = tag.getAttribute("data-tag");
      var idx = activeTags.indexOf(tagText);
      if (idx !== -1) {
        activeTags.splice(idx, 1);
        tag.classList.remove("tag-active");
      } else {
        activeTags.push(tagText);
        tag.classList.add("tag-active");
      }
      setStatus("Tags: " + (activeTags.length > 0 ? activeTags.join(", ") : "none"));
      chrome.runtime.sendMessage({ type: "SAVE_PROFILE_TAGS", payload: activeTags }, function(res) {
        if (chrome.runtime.lastError) {
          setStatus("⚠️ Tag save failed: " + chrome.runtime.lastError.message);
        }
      });
    });
  }

  shadow.querySelectorAll(".profile-tag").forEach(bindTagListener);

  addTagBtn.addEventListener("click", function () {
    var val = customTagIn.value.trim();
    if (!val) return;
    var newTag = document.createElement("span");
    newTag.className = "profile-tag";
    newTag.setAttribute("data-tag", val);
    newTag.textContent = val;
    tagsContainer.appendChild(newTag);
    bindTagListener(newTag);
    customTagIn.value = "";
    setStatus("Added tag: " + val);
  });

  // ==========================================
  // 5. SNIPPETS (via background storage)
  // ==========================================
  function loadSnippets() {
    chrome.runtime.sendMessage({ type: "GET_SNIPPETS" }, function (res) {
      if (chrome.runtime.lastError) {
        setStatus("⚠️ " + chrome.runtime.lastError.message);
        return;
      }
      if (res && res.success && res.data) {
        snippetsList.innerHTML = "";
        if (res.data.length === 0) {
          snippetsList.innerHTML = '<div style="color:#666;font-size:11px;">No snippets yet</div>';
          return;
        }
        res.data.forEach(function (snip) {
          var div = document.createElement("div");
          div.className = "snippet-item";
          div.textContent = snip.text && snip.text.length > 25 ? snip.text.substring(0, 25) + "..." : (snip.text || "empty");
          div.title = snip.text || "";
          div.addEventListener("click", function () {
            if (!activeTextNode) { setStatus("⚠️ Focus a text field first"); return; }
            setText(activeTextNode, getText(activeTextNode) + snip.text);
            setStatus("✅ Snippet inserted");
          });
          snippetsList.appendChild(div);
        });
        setStatus("Loaded " + res.data.length + " snippets");
      }
    });
  }

  saveSnippetBtn.addEventListener("click", function () {
    if (!activeTextNode) { setStatus("⚠️ Focus a text field first"); return; }
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : "";
    if (!text) { setStatus("⚠️ Select text first"); return; }
    
    saveSnippetBtn.textContent = "Saving...";
    chrome.runtime.sendMessage({ type: "SAVE_SNIPPET", payload: text }, function (res) {
      if (chrome.runtime.lastError) {
        setStatus("⚠️ " + chrome.runtime.lastError.message);
        saveSnippetBtn.textContent = "➕ Save Selected Text";
        return;
      }
      saveSnippetBtn.textContent = "➕ Save Selected Text";
      setStatus("✅ Snippet saved");
      loadSnippets();
    });
  });

  loadSnippets();

  // ==========================================
  // 6. SCORE BUTTON (via background → offscreen → Worker)
  // ==========================================
  scoreBtn.addEventListener("click", function () {
    if (!activeTextNode) { setStatus("⚠️ Focus a text field first"); return; }
    var rawInput = getText(activeTextNode);
    if (!rawInput.trim()) { setStatus("⚠️ Text field is empty"); return; }

    var originalText = scoreBtn.textContent;
    scoreBtn.textContent = "⏳";
    setStatus("Scoring prompt...");

    // Init LLM first
    chrome.runtime.sendMessage({ type: "LLM_INIT" });

    chrome.runtime.sendMessage({ type: "LLM_SCORE", target: "offscreen", text: rawInput }, function (res) {
      if (chrome.runtime.lastError) {
        setStatus("⚠️ Score failed: " + chrome.runtime.lastError.message);
        scoreBtn.textContent = originalText;
        return;
      }
      if (res && res.success && res.data) {
        scoreBtn.textContent = res.data.score + "/100";
        setStatus("Score: " + res.data.score + "/100 — " + (res.data.reasoning || ""));
        setTimeout(function () { scoreBtn.textContent = originalText; }, 4000);
      } else {
        scoreBtn.textContent = "ERR";
        setStatus("⚠️ Score failed: " + (res ? res.error : "no response"));
        setTimeout(function () { scoreBtn.textContent = originalText; }, 3000);
      }
    });
  });

  // ==========================================
  // 7. REFACTOR BUTTON (via background → offscreen → Worker)
  // ==========================================
  function doRefactor() {
    if (!activeTextNode) { setStatus("⚠️ Focus a text field first"); return; }
    var rawInput = getText(activeTextNode);
    if (!rawInput.trim()) { setStatus("⚠️ Text field is empty"); return; }

    fabButton.textContent = "🧠 Routing...";
    setStatus("Step 1/3: Fetching context...");

    // Init LLM
    chrome.runtime.sendMessage({ type: "LLM_INIT" });

    // Step 1: Get storage context
    chrome.runtime.sendMessage({ type: "GET_STORAGE_CONTEXT" }, function (storageRes) {
      if (chrome.runtime.lastError) {
        fabButton.textContent = "✨ Refactor";
        setStatus("⚠️ " + chrome.runtime.lastError.message);
        return;
      }
      var context = (storageRes && storageRes.success) ? storageRes.data : {};
      fabButton.textContent = "🛠️ Agents...";
      setStatus("Step 2/3: Running agent orchestration...");

      // Step 2: Run orchestration via offscreen Worker
      chrome.runtime.sendMessage({
        type: "LLM_ORCHESTRATE",
        target: "offscreen",
        prompt: rawInput,
        context: context
      }, function (res) {
        if (chrome.runtime.lastError) {
          fabButton.textContent = "✨ Refactor";
          setStatus("⚠️ " + chrome.runtime.lastError.message);
          return;
        }
        fabButton.textContent = "✨ Refactor";
        if (res && res.success && res.data) {
          debugBtn.style.display = "flex";
          setText(activeTextNode, res.data);
          setStatus("✅ Prompt refactored successfully!");
        } else {
          setStatus("⚠️ Refactor failed: " + (res ? res.error : "no response"));
        }
      });
    });
  }

  fabButton.addEventListener("click", doRefactor);

  // ==========================================
  // 8. DEBUG BUTTON
  // ==========================================
  debugBtn.addEventListener("click", function () {
    if (!activeTextNode) return;
    debugBtn.style.display = "none";
    fabButton.textContent = "🐞 Debug...";
    setStatus("Debug recalibration running...");
    doRefactor();
  });

  // ==========================================
  // 9. PAGE SCRAPER
  // ==========================================
  scrapeBtn.addEventListener("click", function () {
    scrapeBtn.textContent = "📄 Saving...";
    setStatus("Scraping page text...");
    var rawText = document.body.innerText || "";
    var text = rawText.trim().substring(0, 2500);

    chrome.runtime.sendMessage({ type: "SAVE_SCRAPED_CONTEXT", payload: text }, function (res) {
      if (chrome.runtime.lastError) {
        scrapeBtn.textContent = "📄 Read This Page";
        setStatus("⚠️ Save failed: " + chrome.runtime.lastError.message);
        return;
      }
      if (res && res.success) {
        scrapeBtn.textContent = "✅ Saved!";
        setStatus("✅ Page scraped & stored (" + text.length + " chars)");
      } else {
        scrapeBtn.textContent = "❌ Error";
        setStatus("⚠️ " + (res ? res.error : "unknown error"));
      }
      setTimeout(function () { scrapeBtn.textContent = "📄 Read This Page"; }, 2000);
    });
  });

  // ==========================================
  // 10. DOM TRACKING & FAB POSITIONING
  // ==========================================
  document.addEventListener("focusin", handleFocus);
  document.addEventListener("input", handleInput);
  document.addEventListener("click", handleClickGlobal);
  document.addEventListener("scroll", updateFabPosition, { passive: true, capture: true });
  window.addEventListener("resize", updateFabPosition, { passive: true });

  function isValidInputField(target) {
    if (!target) return false;
    var tag = (target.tagName || "").toLowerCase();
    return tag === "textarea" || tag === "input" || target.isContentEditable;
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
    var rect = activeTextNode.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) { fabWrapper.style.display = "none"; return; }
    fabWrapper.style.top = (window.scrollY + rect.bottom - 16 - 40) + "px";
    fabWrapper.style.left = (window.scrollX + rect.right - 16 - 180) + "px";
  }

  function handleClickGlobal(event) {
    if (!activeTextNode) return;
    var insideInput = activeTextNode.contains(event.target);
    var insideShadow = event.composedPath().indexOf(hostElement) !== -1;
    if (!insideInput && !insideShadow) {
      activeTextNode = null;
      fabWrapper.style.display = "none";
    }
  }

  // ==========================================
  // 11. LLM PROGRESS LISTENER
  // ==========================================
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === "LLM_DOWNLOAD_PROGRESS") {
      updateDownloadProgress(msg.progress);
      setStatus("⬇️ Model downloading...");
    }
    if (msg.type === "LLM_READY") {
      dlBar.style.width = "100%";
      dlBar.style.background = "linear-gradient(90deg,#10b981,#34d399)";
      dlStatus.textContent = "✅ Engine ready!" + (msg.isWebGPU ? " (WebGPU)" : " (WASM)");
      dlDetail.textContent = "100%";
      setStatus("✅ LLM engine loaded" + (msg.isWebGPU ? " with WebGPU" : ""));
      setTimeout(hideDownloadOverlay, 3000);
    }
    if (msg.type === "LLM_INIT_ERROR") {
      dlBar.style.background = "linear-gradient(90deg,#ef4444,#f87171)";
      dlStatus.textContent = "❌ " + (msg.error || "Init failed");
      setStatus("❌ LLM init failed: " + (msg.error || "unknown"));
      setTimeout(hideDownloadOverlay, 8000);
    }
  });

})();
