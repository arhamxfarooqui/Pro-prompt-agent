import "fake-indexeddb/auto";
import { jest } from "@jest/globals";
import { initDB } from "./storage.js";

jest.unstable_mockModule("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: jest.fn().mockImplementation(async (model, config) => {
    if (config && config.initProgressCallback) {
      config.initProgressCallback({ progress: 0.5, text: "Downloading" });
      config.initProgressCallback({ progress: 1.0, text: "Loaded" });
    }
    return {
      resetChat: jest.fn().mockResolvedValue(true),
      chat: {
        completions: {
          create: jest.fn().mockImplementation(async (opts) => {
            if (opts.stream) {
              return (async function* () {
                yield { choices: [{ delta: { content: "Hel" } }] };
                yield { choices: [{ delta: { content: "lo" } }] };
              })();
            } else {
              const query = opts.messages[opts.messages.length - 1].content;
              if (query.includes("Evaluate this")) {
                // Return explicitly hallucinated Markdown text framing to test our Regex sanitizer
                return { choices: [{ message: { content: '```json\n{"score": 95, "reasoning": "perfect pipeline"}\n```' } }] };
              }
              return { choices: [{ message: { content: `Mocked logic for agent` } }] };
            }
          })
        }
      }
    };
  })
}));

global.navigator = { gpu: undefined };
const mockPostMessage = jest.fn();
global.self = { postMessage: mockPostMessage };

await import("./worker.js");

describe("Module 1 (Worker Logic): Phase 1.2 & 1.3 Integrated Testing", () => {
  beforeEach(() => {
    mockPostMessage.mockClear(); 
  });

  // ========== PHASE 1.2 TESTS (Regressions) ==========
  test("1. PING Router (Heartbeat Protocol)", async () => {
    await global.self.onmessage({ data: { type: "PING" } });
    expect(mockPostMessage).toHaveBeenCalled();
    const resultMsg = mockPostMessage.mock.calls[0][0];
    expect(resultMsg.type).toBe("PONG");
  });

  test("2. INIT_ENGINE Route (Hardware check & MLC Initialization)", async () => {
    await global.self.onmessage({ data: { type: "INIT_ENGINE", payload: { modelName: "mock-gemma", capVRAM: 2048 } } });
    const messages = mockPostMessage.mock.calls.map(call => call[0]);
    expect(messages.find(m => m.type === "INIT_COMPLETE")).toBeDefined();
  });

  // ========== PHASE 1.3 TESTS (The Speed Pipeline) ==========
  test("3. GENERATE_STREAM (Streaming Iterators & Reset State)", async () => {
    // Requires executing INIT_ENGINE first to establish global 'engine' pointer
    await global.self.onmessage({ data: { type: "INIT_ENGINE", payload: {} } });
    mockPostMessage.mockClear();

    await global.self.onmessage({ data: { type: "GENERATE_STREAM", payload: { id: "req_test", prompt: "Test stream" } } });
    
    const messages = mockPostMessage.mock.calls.map(c => c[0]);
    const tokens = messages.filter(m => m.type === "STREAM_TOKEN").map(m => m.data);
    
    expect(tokens).toEqual(["Hel", "lo"]); // Evaluated dynamically via async iterators
    const completeTarget = messages.find(m => m.type === "STREAM_COMPLETE");
    expect(completeTarget).toBeDefined();
    expect(completeTarget.id).toBe("req_test");
  });

  test("4. RUN_BATCH (Strict VRAM Queueing & Isolation)", async () => {
    await global.self.onmessage({ data: { type: "INIT_ENGINE", payload: {} } });
    mockPostMessage.mockClear();

    const mockBatch = [
      { agentId: "agent1", prompt: "Task 1" },
      { agentId: "agent2", prompt: "Task 2" }
    ];

    await global.self.onmessage({ data: { type: "RUN_BATCH", payload: { id: "req_batch", batch: mockBatch } } });
    
    // We expect iterative processing mapping results cleanly back to arrays
    const resultMsg = mockPostMessage.mock.calls.find(c => c[0].type === "BATCH_COMPLETE");
    expect(resultMsg).toBeDefined();
    expect(resultMsg[0].data.length).toBe(2);
    expect(resultMsg[0].data[0].result).toContain("Mocked logic");
  });

  test("5. RUN_SCORER (Regex Parsing Hallucinations)", async () => {
    await global.self.onmessage({ data: { type: "INIT_ENGINE", payload: {} } });
    mockPostMessage.mockClear();

    await global.self.onmessage({ data: { type: "RUN_SCORER", payload: { id: "req_scorer", text: "Evaluate this script." } } });
    
    const resultMsg = mockPostMessage.mock.calls.find(c => c[0].type === "SCORE_RESULT");
    expect(resultMsg).toBeDefined();
    
    // The explicit markdown wrapper text applied in the mock (```json...```) must be dynamically filtered out natively.
    expect(resultMsg[0].data.score).toBe(95);
    expect(resultMsg[0].data.reasoning).toBe("perfect pipeline");
  });
});
