/**
 * autocomplete-ui.js — Plain JS content script (NO ES module imports).
 * Ghost text autocomplete. LLM streaming goes through background → offscreen → Worker.
 */
(function initAutocompleteEngine() {
  "use strict";
  console.log("[Ghost UI] Autocomplete engine loaded.");

  var typingTimer = null;
  var currentGhostText = "";
  var targetArea = null;

  var ghostSpan = document.createElement("span");
  ghostSpan.style.cssText = "position:absolute;color:#9ca3af;pointer-events:none;z-index:2147483646;display:none;white-space:pre-wrap;";
  document.body.appendChild(ghostSpan);

  document.addEventListener("focusin", handleFocus);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeyDown, true);

  function isValidInputField(target) {
    if (!target) return false;
    return (target.tagName || "").toLowerCase() === "textarea";
  }

  function handleFocus(event) {
    if (isValidInputField(event.target)) {
      targetArea = event.target;
      clearGhost();
    }
  }

  function handleInput(event) {
    if (!isValidInputField(event.target)) return;
    targetArea = event.target;
    clearGhost();
    clearTimeout(typingTimer);

    typingTimer = setTimeout(function () {
      var text = targetArea.value.substring(0, targetArea.selectionStart);
      triggerAutocomplete(text);
    }, 500);
  }

  function triggerAutocomplete(promptString) {
    if (!promptString || promptString.trim().length < 5) return;

    // Init LLM (fire-and-forget)
    chrome.runtime.sendMessage({ type: "LLM_INIT" });

    // Request completion via background → offscreen → Worker
    chrome.runtime.sendMessage({
      type: "LLM_STREAM",
      target: "offscreen",
      prompt: promptString
    }, function (res) {
      if (chrome.runtime.lastError) {
        console.warn("[Ghost UI] Stream error:", chrome.runtime.lastError.message);
        return;
      }
      if (res && res.success && res.data) {
        currentGhostText = res.data;
        renderGhost();
      }
    });
  }

  function renderGhost() {
    if (!targetArea || !currentGhostText) return;

    var mirrorDiv = document.createElement("div");
    var styles = window.getComputedStyle(targetArea);

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

    mirrorDiv.textContent = targetArea.value.substring(0, targetArea.selectionStart);

    var indicatorSpan = document.createElement("span");
    indicatorSpan.textContent = "|";
    mirrorDiv.appendChild(indicatorSpan);

    var rect = targetArea.getBoundingClientRect();
    var scrollY = window.scrollY || document.documentElement.scrollTop;
    var scrollX = window.scrollX || document.documentElement.scrollLeft;

    ghostSpan.style.top = (rect.top + scrollY + indicatorSpan.offsetTop - targetArea.scrollTop) + "px";
    ghostSpan.style.left = (rect.left + scrollX + indicatorSpan.offsetLeft - targetArea.scrollLeft) + "px";
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
        insertText(targetArea, currentGhostText);
        clearGhost();
      } else {
        clearGhost();
      }
    }
  }

  function insertText(el, textBlock) {
    var val = el.value;
    var cursor = el.selectionStart;
    el.value = val.substring(0, cursor) + textBlock + val.substring(el.selectionEnd);
    el.selectionStart = el.selectionEnd = cursor + textBlock.length;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function clearGhost() {
    currentGhostText = "";
    ghostSpan.style.display = "none";
  }
})();
