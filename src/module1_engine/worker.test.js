import "fake-indexeddb/auto";
import { jest } from "@jest/globals";
import { initDB } from "./storage.js";

// Mock WebLLM to prevent actual model downloads in the NodeJS test environment
jest.unstable_mockModule("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: jest.fn().mockImplementation(async (model, config) => {
    // Simulate real WebLLM loading callbacks
    if (config && config.initProgressCallback) {
      config.initProgressCallback({ progress: 0.5, text: "Downloading model chunks" });
      config.initProgressCallback({ progress: 1.0, text: "Model Loaded" });
    }
    return { mockEngineStatus: "Ready" };
  })
}));

// Mock missing browser globals natively missing in Node
global.navigator = { 
  gpu: undefined // Simulating missing WebGPU
};

const mockPostMessage = jest.fn();
global.self = {
  postMessage: mockPostMessage
};

// Dynamically import the worker after injecting the mock WebLLM ecosystem
await import("./worker.js");

describe("Phase 1.2: Engine Worker Tests", () => {
  beforeEach(() => {
    mockPostMessage.mockClear(); 
  });

  test("1. PING Router Message (Heartbeat Protocol)", async () => {
    await global.self.onmessage({ data: { type: "PING" } });
    
    expect(mockPostMessage).toHaveBeenCalled();
    const resultMsg = mockPostMessage.mock.calls[0][0];
    
    expect(resultMsg.type).toBe("PONG");
    expect(resultMsg.status).toBe("active");
    expect(resultMsg.timestamp).toBeGreaterThan(1000);
  });

  test("2. INIT_ENGINE Route (Hardware check & MLC Initialization)", async () => {
    await global.self.onmessage({ 
        data: { 
            type: "INIT_ENGINE", 
            payload: { modelName: "mock-gemma", capVRAM: 2048 } 
        } 
    });

    const messages = mockPostMessage.mock.calls.map(call => call[0]);
    
    // WebGL fallback check -> Natively triggered because navigator.gpu is undefined in Node
    const statusMsg = messages.find(m => m.type === "INIT_STATUS");
    expect(statusMsg).toBeDefined();
    expect(statusMsg.status).toBe("degraded_performance");

    // Progress callbacks tracking validation
    const progressMsgs = messages.filter(m => m.type === "INIT_PROGRESS");
    expect(progressMsgs.length).toBeGreaterThan(0);
    expect(progressMsgs[0].data.progress).toBe(0.5);

    // Final hydration hook
    const completeMsg = messages.find(m => m.type === "INIT_COMPLETE");
    expect(completeMsg).toBeDefined();
    expect(completeMsg.isWebGPU).toBe(false);
  });

  test("3. FETCH_CONTEXT Route (Secure IDB memory slicing)", async () => {
    // Seed IDB manually via standard engine logic before worker queries it
    const db = await initDB();
    const transaction = db.transaction("ContextTable", "readwrite");
    const store = transaction.objectStore("ContextTable");
    
    store.put({
      chunkId: "c_test1",
      profileId: "mock_agent",
      source: "Manual",
      text: "System prompt first block.",
      timestamp: 1000,
      isArchived: false
    });
    store.put({
      chunkId: "c_test2",
      profileId: "mock_agent",
      source: "Manual",
      text: "Recent typed commands.",
      timestamp: 2000,
      isArchived: false
    });
    // This archaic memory should inherently be mathematically purged
    store.put({
      chunkId: "c_test3",
      profileId: "mock_agent",
      source: "System",
      text: "[ARCHIVED OLD DATA]",
      timestamp: 500,
      isArchived: true
    });

    // Wait for insertion
    await new Promise(resolve => {
        transaction.oncomplete = () => resolve();
    });

    // Mock an ecosystem fetching call from Master Agent
    await global.self.onmessage({
        data: {
            type: "FETCH_CONTEXT",
            payload: { profileId: "mock_agent" }
        }
    });

    // Wait 50ms for asynchronous IDB cursor success events to bubble up correctly inside Node Environment
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockPostMessage).toHaveBeenCalled();
    
    // Find the FETCH_CONTEXT_RESULT message among potentially other postMessages
    const retrievedContext = mockPostMessage.mock.calls
       .map(c => c[0])
       .find(m => m.type === "FETCH_CONTEXT_RESULT");

    expect(retrievedContext).toBeDefined();
    expect(retrievedContext.profileId).toBe("mock_agent");
    // Explicitly joining without the archived element and chronological order:
    expect(retrievedContext.data).toBe("System prompt first block.\nRecent typed commands.");
  });
});
