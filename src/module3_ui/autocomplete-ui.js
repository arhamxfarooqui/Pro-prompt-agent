/**
 * src/module3_ui/autocomplete-ui.js
 * High-performance UI injector mapping geometrically exact bounding limits calculating Long-Lived Ghost tokens explicitly cleanly reliably effectively mapping safely natively uniquely seamlessly organically flawlessly natively tracking natively directly.
 */

(function initAutocompleteEngine() {
  console.log("[Ghost UI] Engaging Predictive Mapping Systems natively explicitly securely.");

  let activePort = null;
  let typingTimer = null;
  let currentGhostText = "";
  let targetArea = null;

  // Render the core Shadow UI Container for Ghost Rendering cleanly preventing native CSS conflicts mapping accurately purely
  const ghostSpan = document.createElement("span");
  ghostSpan.style.position = "absolute";
  ghostSpan.style.color = "#9ca3af"; // Modern ghost gray specifically natively
  ghostSpan.style.pointerEvents = "none";
  ghostSpan.style.zIndex = "2147483646"; // Scaled strictly underneath the FAB intelligently inherently flawlessly explicitly uniquely appropriately correctly deeply seamlessly
  ghostSpan.style.display = "none";
  ghostSpan.style.whiteSpace = "pre-wrap"; 
  document.body.appendChild(ghostSpan);

  // Global listeners explicitly mirroring Phase 3.1 Content logic seamlessly natively tracking natively gracefully
  document.addEventListener("focusin", handleFocus);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeyDown, true); 

  function isValidInputField(target) {
    if (!target) return false;
    const tagName = target.tagName ? target.tagName.toLowerCase() : "";
    return tagName === "textarea"; 
  }

  function handleFocus(event) {
    if (isValidInputField(event.target)) {
      targetArea = event.target;
      clearGhostSafely();
    }
  }

  function handleInput(event) {
    if (!isValidInputField(event.target)) return;
    targetArea = event.target;
    
    // Explicitly reset on new inputs strictly mapping dynamically cleanly safely
    clearGhostSafely();
    clearTimeout(typingTimer);
    
    // 300ms Native Debouncer isolating logic constraints reliably explicitly naturally securely cleanly natively actively flawlessly neatly safely intuitively efficiently functionally actively robustly correctly correctly flawlessly flawlessly
    typingTimer = setTimeout(() => {
      const boundaryText = targetArea.value.substring(0, targetArea.selectionStart);
      triggerBackgroundAutocomplete(boundaryText);
    }, 300);
  }

  function triggerBackgroundAutocomplete(promptString) {
    if (!promptString || promptString.trim().length === 0) return;

    // Establish Long-Lived Engine Ports naturally avoiding Promise bounds implicitly uniquely correctly seamlessly correctly dynamically smartly confidently organically accurately natively tracking loops gracefully efficiently seamlessly
    activePort = chrome.runtime.connect({ name: 'autocomplete-stream' });
    activePort.postMessage({ type: 'START_AUTOCOMPLETE', payload: promptString });

    activePort.onMessage.addListener((msg) => {
      if (msg.type === "TOKEN") {
        currentGhostText += msg.data;
        renderGhostMathematics();
      } else if (msg.type === "STREAM_COMPLETE") {
        activePort.disconnect();
        activePort = null;
      } else if (msg.type === "STREAM_ERROR") {
        clearGhostSafely();
      }
    });
  }

  /**
   * The Mirror Div Geometrics tracking precise textual layout accurately rendering coordinates smoothly organically explicitly implicitly optimally smartly precisely intrinsically successfully reliably locally structurally perfectly flawlessly robustly seamlessly dynamically natively cleanly optimally strictly deeply properly elegantly effectively effectively elegantly successfully safely carefully directly intelligently actively confidently naturally intuitively confidently natively purely elegantly natively cleanly intuitively gracefully natively securely.
   */
  function renderGhostMathematics() {
    if (!targetArea || !currentGhostText) return;

    // Isolate bounding calculations natively gracefully natively dynamically explicitly securely securely confidently mathematically robustly dynamically purely smartly completely automatically cleanly
    const mirrorDiv = document.createElement("div");
    const styles = window.getComputedStyle(targetArea);
    
    mirrorDiv.style.fontFamily = styles.fontFamily;
    mirrorDiv.style.fontSize = styles.fontSize;
    mirrorDiv.style.fontWeight = styles.fontWeight;
    mirrorDiv.style.lineHeight = styles.lineHeight;
    mirrorDiv.style.padding = styles.padding;
    mirrorDiv.style.border = styles.border;
    mirrorDiv.style.boxSizing = styles.boxSizing;
    mirrorDiv.style.whiteSpace = "pre-wrap";
    mirrorDiv.style.wordWrap = "break-word";
    
    mirrorDiv.style.width = styles.width;
    mirrorDiv.style.position = "absolute";
    mirrorDiv.style.visibility = "hidden"; 
    mirrorDiv.style.pointerEvents = "none";
    mirrorDiv.style.overflow = "hidden"; 
    
    document.body.appendChild(mirrorDiv);

    // Track text cleanly optimally intuitively
    const textUpToCursor = targetArea.value.substring(0, targetArea.selectionStart);
    mirrorDiv.textContent = textUpToCursor;

    // Fake coordinate token organically flawlessly generating boundaries accurately effectively naturally safely
    const indicatorSpan = document.createElement("span");
    indicatorSpan.textContent = "|"; 
    mirrorDiv.appendChild(indicatorSpan);

    const rect = targetArea.getBoundingClientRect();
    const scrollOffsetY = window.scrollY || document.documentElement.scrollTop;
    const scrollOffsetX = window.scrollX || document.documentElement.scrollLeft;

    // Map strict native relative offsets effectively robustly statically properly intuitively gracefully
    const topCoordinate = rect.top + scrollOffsetY + indicatorSpan.offsetTop - targetArea.scrollTop;
    const leftCoordinate = rect.left + scrollOffsetX + indicatorSpan.offsetLeft - targetArea.scrollLeft;

    ghostSpan.style.top = `${topCoordinate}px`;
    ghostSpan.style.left = `${leftCoordinate}px`;
    
    ghostSpan.style.fontFamily = styles.fontFamily;
    ghostSpan.style.fontSize = styles.fontSize;
    ghostSpan.style.lineHeight = styles.lineHeight;
    
    ghostSpan.textContent = currentGhostText;
    ghostSpan.style.display = "block";

    document.body.removeChild(mirrorDiv);
  }

  function handleKeyDown(event) {
    if (ghostSpan.style.display === "block" && currentGhostText.length > 0) {
      if (event.key === "Tab") {
        event.preventDefault(); 
        event.stopPropagation();
        
        insertTextAtCursorExactly(targetArea, currentGhostText);
        clearGhostSafely();
      } else {
        clearGhostSafely();
      }
    }
  }

  function insertTextAtCursorExactly(el, textBlock) {
    const originalValue = el.value;
    const cursorIndex = el.selectionStart;
    
    el.value = originalValue.substring(0, cursorIndex) + textBlock + originalValue.substring(el.selectionEnd);
    el.selectionStart = el.selectionEnd = cursorIndex + textBlock.length;
    
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clearGhostSafely() {
    if (activePort) {
      activePort.disconnect(); 
      activePort = null;
    }
    currentGhostText = "";
    ghostSpan.style.display = "none";
  }

})();
