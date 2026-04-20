/**
 * src/module3_ui/content.js
 * In-DOM Context Execution securely wrapping dynamic interactions and Shadow UI explicitly mapping without conflicts natively.
 */

(function initAgenticOrchestrator() {
  console.log("[Agentic Orchestrator] Initializing Shadow DOM Telemetry structurally...");

  // ==========================================
  // 1. ISOLATED SHADOW DOM INJECTION
  // ==========================================
  
  const hostId = "agentic-orchestrator-host";
  if (document.getElementById(hostId)) return; // Nullify duplicate browser injections implicitly
  
  const hostElement = document.createElement("div");
  hostElement.id = hostId;
  hostElement.style.position = "absolute";
  hostElement.style.top = "0";
  hostElement.style.left = "0";
  hostElement.style.width = "100%";
  hostElement.style.height = "0";
  hostElement.style.overflow = "visible";
  hostElement.style.zIndex = "2147483647"; // Absolute maximum bounds
  hostElement.style.pointerEvents = "none"; // Make structurally click-through unless targeting FAB dynamically
  
  document.body.appendChild(hostElement);

  // Exposing DOM internally encapsulating securely preventing CSS bleeds inherently globally
  const shadow = hostElement.attachShadow({ mode: "open" });

  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  // Resolving correctly based on workspace root mapped accurately externally
  styleLink.href = chrome.runtime.getURL("src/module3_ui/styles.css");
  shadow.appendChild(styleLink);

  const fabWrapper = document.createElement("div");
  fabWrapper.className = "fab-wrapper";
  fabWrapper.style.display = "none"; 
  
  fabWrapper.innerHTML = `<button class="fab-button">✨ Refactor</button>`;
  shadow.appendChild(fabWrapper);


  // ==========================================
  // 2. ACTIVE ELEMENT DOM TRACKING
  // ==========================================

  const fabButton = shadow.querySelector('.fab-button');
  let activeTextNode = null;

  // Global event delegation explicitly mitigating expensive interval bounds structurally organically natively bounds
  document.addEventListener("focusin", handleFocus);
  document.addEventListener("input", handleInput);
  document.addEventListener("click", handleClickGlobal);
  
  // Implicitly handle scrolling resolving coordinate math geometry smoothly explicitly
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
    
    // Explicit geometric rendering dynamically tracking local bounds accurately
    const rect = activeTextNode.getBoundingClientRect();
    
    // Auto-hide when target naturally unrenders structurally implicitly explicitly
    if (rect.width === 0 || rect.height === 0) {
      fabWrapper.style.display = "none";
      return;
    }

    const offsetBottom = 16;
    const offsetRight = 16;
    const fabPredictedHeight = 40;
    const fabPredictedWidth = 120;

    // Resolve mathematical offset dynamically integrating scroll bounds intrinsically explicitly 
    const absoluteTop = window.scrollY + rect.bottom - offsetBottom - fabPredictedHeight; 
    const absoluteLeft = window.scrollX + rect.right - offsetRight - fabPredictedWidth; 

    fabWrapper.style.top = `${absoluteTop}px`;
    fabWrapper.style.left = `${absoluteLeft}px`;
  }

  // Determine structural click boundaries masking implicitly correctly evaluating shadow intercepts safely natively
  function handleClickGlobal(event) {
    if (!activeTextNode) return;

    // Check mapping correctly catching native structural interactions strictly cleanly natively explicitly resolving inherently
    const clickedInsideInput = activeTextNode.contains(event.target);
    const clickedInsideShadowRoot = event.composedPath().includes(hostElement);

    if (!clickedInsideInput && !clickedInsideShadowRoot) {
      activeTextNode = null;
      fabWrapper.style.display = "none";
    }
  }

  fabButton.addEventListener("click", () => {
    if (!activeTextNode) return;
    console.log("[Agentic Orchestrator] ✨ Refactor inherently clicked!");
  });

})();
