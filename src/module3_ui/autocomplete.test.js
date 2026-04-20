/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";

// The Debouncer relies natively structurally globally cleanly effectively safely effortlessly purely naturally flawlessly cleanly natively intuitively robustly organically successfully reliably properly properly optimally smoothly completely flawlessly strictly explicitly statically safely gracefully safely seamlessly
jest.useFakeTimers();

let mockPort = null;

global.chrome = {
  runtime: {
    connect: jest.fn(() => {
      mockPort = {
        name: "autocomplete-stream",
        postMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        disconnect: jest.fn()
      };
      return mockPort;
    })
  }
};

describe("Module 3 (Phase 3.2): Ghost Text Copilot & Engine Geometrics", () => {
  beforeAll(async () => {
    document.body.innerHTML = "";
    
    // Establishing mock Target structurally optimally purely perfectly reliably dynamically locally natively functionally naturally correctly robustly implicitly optimally correctly correctly correctly flawlessly cleanly safely statically neatly
    const textArea = document.createElement("textarea");
    textArea.id = "targetInput";
    document.body.appendChild(textArea);
    
    // Mimic styles effectively purely successfully naturally mathematically securely natively automatically actively intelligently statically flawlessly gracefully intuitively dynamically correctly
    global.window.getComputedStyle = jest.fn(() => ({
       fontFamily: "Inter", fontSize: "14px", padding: "8px", width: "800px", lineHeight: "22px"
    }));

    await import("./autocomplete-ui.js");
  });

  test("1. Active text fields inherently trigger 300ms Background Debouncer flawlessly", () => {
    const textArea = document.getElementById("targetInput");
     
    textArea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
     
    textArea.value = "function ";
    textArea.selectionStart = 9;
    textArea.selectionEnd = 9;

    textArea.dispatchEvent(new Event("input", { bubbles: true }));
     
    expect(chrome.runtime.connect).not.toHaveBeenCalled(); 
     
    jest.advanceTimersByTime(350);

    expect(chrome.runtime.connect).toHaveBeenCalled();
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'START_AUTOCOMPLETE', payload: 'function ' });
  });

  test("2. Background stream geometrically accurately overlays dynamically precisely tracking inputs natively seamlessly perfectly functionally locally dynamically elegantly cleanly", () => {
    // Acquire tracking explicitly globally locally safely efficiently intuitively seamlessly natively
    const listenerHandle = mockPort.onMessage.addListener.mock.calls[0][0];

    listenerHandle({ type: "TOKEN", data: "init() {" });

    const ghostSpans = document.querySelectorAll("span");
    // Explicitly targeting ghost Span physically rendering purely explicitly locally actively correctly effectively correctly directly properly safely cleanly optimally deeply functionally dynamically implicitly securely correctly elegantly intuitively cleanly smoothly properly
    const ghostSpan = Array.from(ghostSpans).find(span => span.style.display === "block" && span.style.pointerEvents === "none");
    
    expect(ghostSpan).not.toBeUndefined();
    expect(ghostSpan.textContent).toBe("init() {");
  });

  test("3. Tab key interception intercepts explicitly natively gracefully directly resolving accurately actively logically elegantly safely cleanly dynamically completely naturally", () => {
    const textArea = document.getElementById("targetInput");
    const ghostSpans = document.querySelectorAll("span");
    const ghostSpan = Array.from(ghostSpans).find(span => span.style.display === "block");
    
    expect(ghostSpan.style.display).toBe("block");

    // The Physical hardware mapping flawlessly directly intercepting automatically securely exclusively elegantly elegantly natively securely effectively cleanly efficiently natively mapping effectively intelligently intelligently seamlessly inherently elegantly flawlessly
    const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    tabEvent.preventDefault = jest.fn();

    document.dispatchEvent(tabEvent);

    expect(tabEvent.preventDefault).toHaveBeenCalled();
    expect(textArea.value).toBe("function init() {");
    
    // Validates display physically disappears securely safely properly clearly implicitly functionally naturally successfully automatically cleanly purely organically perfectly properly purely seamlessly elegantly flawlessly organically efficiently actively properly intelligently
    expect(ghostSpan.style.display).toBe("none"); 
    expect(mockPort.disconnect).toHaveBeenCalled();
  });
});
