/**
 * src/module3_ui/autocomplete-ui.js
 * Ghost text autocomplete UI.
 * Uses llmClient directly to stream tokens from the Web Worker.
 */

import { llmClient } from "../module1_engine/llm-client.js";

(function initAutocompleteEngine() {
  console.log("[Ghost UI] Engaging Predictive Mapping Systems.");

  let typingTimer = null;
  let currentGhostText = "";
  let targetArea = null;
  let isStreaming = false;
  let llmInitialized = false;

  function ensureLLMReady() {
    if (!llmInitialized) {
      llmClient.initialize("gemma-2b-it-q4f16_1-MLC", 2048);
      llmInitialized = true;
    }
  }

  // Ghost text overlay element
  const ghostSpan = document.createElement("span");
  ghostSpan.style.position = "absolute";
  ghostSpan.style.color = "#9ca3af";
  ghostSpan.style.pointerEvents = "none";
  ghostSpan.style.zIndex = "2147483646";
  ghostSpan.style.display = "none";
  ghostSpan.style.whiteSpace = "pre-wrap";
  document.body.appendChild(ghostSpan);

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

    clearGhostSafely();
    clearTimeout(typingTimer);

    // 300ms debounce before triggering autocomplete
    typingTimer = setTimeout(() => {
      const boundaryText = targetArea.value.substring(0, targetArea.selectionStart);
      triggerAutocomplete(boundaryText);
    }, 300);
  }

  function triggerAutocomplete(promptString) {
    if (!promptString || promptString.trim().length === 0) return;
    ensureLLMReady();

    isStreaming = true;

    // Stream directly via the Worker (no background port needed)
    llmClient.streamAutocomplete(promptString, (tokenDelta) => {
      currentGhostText += tokenDelta;
      renderGhostMathematics();
    })
    .then(() => {
      isStreaming = false;
    })
    .catch(() => {
      clearGhostSafely();
      isStreaming = false;
    });
  }

  /**
   * Mirror Div geometry tracking for precise ghost text positioning.
   */
  function renderGhostMathematics() {
    if (!targetArea || !currentGhostText) return;

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

    const textUpToCursor = targetArea.value.substring(0, targetArea.selectionStart);
    mirrorDiv.textContent = textUpToCursor;

    const indicatorSpan = document.createElement("span");
    indicatorSpan.textContent = "|";
    mirrorDiv.appendChild(indicatorSpan);

    const rect = targetArea.getBoundingClientRect();
    const scrollOffsetY = window.scrollY || document.documentElement.scrollTop;
    const scrollOffsetX = window.scrollX || document.documentElement.scrollLeft;

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
    currentGhostText = "";
    ghostSpan.style.display = "none";
    isStreaming = false;
  }

})();
