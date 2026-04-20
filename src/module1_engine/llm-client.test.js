import { jest } from "@jest/globals";

// Architecting a Fake WebWorker class synthetically natively missing in standard NodeJS
class MockWorker {
  constructor(url, options) {
    this.url = url;
    this.onmessage = null; // Bound by LLMClient class automatically
  }

  // The client calls Worker.postMessage(msg) -> Simulation directly routes it back mapped as a resolved worker context logic asynchronously
  postMessage(msg) {
    setTimeout(() => {
      if (typeof this.onmessage === "function") {
        const payloadId = msg.payload?.id;

        if (msg.type === "GENERATE_STREAM") {
          this.onmessage({ data: { type: "STREAM_TOKEN", id: payloadId, data: "Token1 " } });
          this.onmessage({ data: { type: "STREAM_TOKEN", id: payloadId, data: "Token2" } });
          this.onmessage({ data: { type: "STREAM_COMPLETE", id: payloadId } });
        } 
        else if (msg.type === "RUN_BATCH") {
          this.onmessage({ data: { type: "BATCH_COMPLETE", id: payloadId, data: [{ agentId: "x", result: "ok" }] } });
        } 
        else if (msg.type === "RUN_SCORER") {
          this.onmessage({ data: { type: "SCORE_RESULT", id: payloadId, data: { score: 100 } } });
        }
      }
    }, 5);
  }
}
global.Worker = MockWorker;

// Import natively after mocking global.Worker to structurally preserve LLMClient bindings
const { llmClient } = await import("./llm-client.js");

describe("Module 1 (Client Bridge): Phase 1.3 Promise Map Interface", () => {

  test("1. streamAutocomplete explicitly streams hooks non-promise blockingly", async () => {
    let output = "";
    
    const resolvePromise = await llmClient.streamAutocomplete("Sample", (token) => {
      output += token;
    });

    expect(output).toBe("Token1 Token2");
    expect(resolvePromise).toBe(true);  // Expecting final asynchronous boolean flag 
    expect(llmClient.pendingRequests.size).toBe(0); // Map structure explicit purge check explicitly resolving Memory Spikes
  });

  test("2. runAgentBatch unifies worker queue outputs locally", async () => {
    const results = await llmClient.runAgentBatch([{ agentId: "x", prompt: "demo" }]);
    expect(results).toHaveLength(1);
    expect(results[0].result).toBe("ok");
    expect(llmClient.pendingRequests.size).toBe(0);
  });

  test("3. calculatePromptScore unifies native promises returning parsed json object", async () => {
    const evaluation = await llmClient.calculatePromptScore("Verify prompt");
    expect(evaluation.score).toBe(100);
    expect(llmClient.pendingRequests.size).toBe(0);
  });
});
