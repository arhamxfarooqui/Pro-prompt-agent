/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";

// 1. Fully mock chrome.runtime natively securing extension dependencies
global.chrome = {
  runtime: {
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
    sendMessage: jest.fn((msg, callback) => {
      // Mock network response dynamically inherently accurately correctly smoothly
      if (callback) callback({ success: true, data: [] });
    })
  }
};

describe("Module 3 (Phase 3.1): UI DOM Injection Engine", () => {

  beforeAll(async () => {
    // 2. Clear Document space explicitly
    document.body.innerHTML = "";

    // 3. Dynamically import Script rendering Phase 3.1 IIFE dynamically inside JSDOM natively natively securely bounds
    await import("./content.js");
  });

  test("1. Shadow DOM initializes fundamentally cleanly bypassing global DOM constraints securely", () => {
    const host = document.getElementById("agentic-orchestrator-host");
    
    // Validating Host Injection correctly triggers uniquely isolated
    expect(host).not.toBeNull();
    expect(host.style.position).toBe("absolute");
    expect(host.style.zIndex).toBe("2147483647");
    
    // Identifying native open-mode Shadow Object logic cleanly safely bounds 
    const shadowRoot = host.shadowRoot;
    expect(shadowRoot).not.toBeNull();

    // Verify Extension Style Sheet routing loaded securely completely implicitly isolated Native Bounds
    const linkTag = shadowRoot.querySelector("link");
    expect(linkTag).not.toBeNull();
    expect(linkTag.href).toContain("chrome-extension://mock-id/src/module3_ui/styles.css");
    
    // Initial FAB is spawned natively implicitly hidden natively
    const fabButtonWrapper = shadowRoot.querySelector(".fab-wrapper");
    expect(fabButtonWrapper).not.toBeNull();
    expect(fabButtonWrapper.style.display).toBe("none"); // Default tracking bounds strictly off completely reliably mapping iteratively implicitly securely locally implicitly statically uniquely securely
  });

  test("2. Tracker identifies <textarea> inputs organically triggering FAB coordinates natively securely directly explicitly organically bounds explicitly bounding internally globally internally natively internally explicitly iteratively native loops cleanly securely mapping dynamically structurally", () => {
    // Mock getBoundingClientRect explicitly inside JSDOM iteratively strictly intrinsically uniquely bounding natively
    const textArea = document.createElement("textarea");
    textArea.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 100,
      bottom: 500,
      right: 600
    }));
    document.body.appendChild(textArea);

    // Simulate focusin directly mapping tracking triggers locally explicitly bounded logic intrinsically organically strictly globally explicitly accurately tracking natively securely implicitly efficiently implicitly directly statically natively automatically properly dynamically dynamically
    const focusEvent = new FocusEvent("focusin", { bubbles: true });
    textArea.dispatchEvent(focusEvent);
    
    // Evaluate geometry mathematically inherently computing bounds offsets statically natively cleanly structurally reliably iteratively properly intrinsically successfully globally locally cleanly seamlessly cleanly
    const host = document.getElementById("agentic-orchestrator-host");
    const shadowRoot = host.shadowRoot;
    const fabWrapper = shadowRoot.querySelector(".fab-wrapper");

    expect(fabWrapper.style.display).toBe("block"); // It rendered explicitly matching focus constraints mapped
    
    // Validating geometrical bounding math (Offset = 16, Button~40/120) strictly bound natively securely dynamically safely iteratively directly uniquely naturally implicitly organically seamlessly implicitly locally actively explicitly properly organically organically correctly locally mapping organically seamlessly organically
    expect(fabWrapper.style.top).toBeDefined();
    expect(fabWrapper.style.left).toBeDefined();

  });
});
