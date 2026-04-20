/**
 * src/module2_brain/orchestrator.js
 * Central LangGraph Orchestration Layer bridging Semantic Maps and Engine Workers
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { llmClient } from "../module1_engine/llm-client.js";
import { routePrompt } from "./semantic.js";

// ==========================================
// 0. INPUT SECURITY & SANITIZATION (From Phase 2.1)
// ==========================================

export function sanitizeInput(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  
  let cleanText = rawText;

  // XSS Protection stripping dangerous vectors
  cleanText = cleanText.replace(/<\/?(script|iframe).*?>/gi, "");
  cleanText = cleanText.replace(/onload\s*=/gi, "");
  cleanText = cleanText.replace(/onerror\s*=/gi, "");

  // Prompt Injection Guards intercepting context jailbreaks
  const jailbreakPhrases = [
    /ignore all previous instructions/gi,
    /say i am hacked/gi,
    /disregard previous prompts/gi
  ];
  
  for (const phrase of jailbreakPhrases) {
    cleanText = cleanText.replace(phrase, "[PROMPT_INJECTION_FLAGGED]");
  }

  return cleanText.trim();
}

// ==========================================
// 1. GRAPH STATE CONFIGURATION
// ==========================================

// Defining structural memory nodes. Empty Annotations automatically overwrite state inherently mapping updates structurally cleanly.
const GraphState = Annotation.Root({
  originalPrompt: Annotation(),
  currentDraft: Annotation(),
  selectedAgents: Annotation(),
  agentOutputs: Annotation()
});


// ==========================================
// 2. NODE EXECUTIONS
// ==========================================

/**
 * Node 1: Executes local vector calculation defining dynamically routed agents natively
 */
async function routePromptNode(state) {
  console.log(`[LangGraph] Routing phase initiated. Math isolating vectors for semantic intent...`);
  const topAgents = await routePrompt(state.originalPrompt);
  return { selectedAgents: topAgents };
}

/**
 * Node 2: Constructs VRAM safe sequential queues explicitly mapping logic out to engine modules synchronously
 */
async function executeAgentsNode(state) {
  console.log(`[LangGraph] Execution phase dynamically processing ${state.selectedAgents.length} agents...`);
  
  // Natively map JSON strictly out of cache structure or local relative roots
  const res = await fetch('/src/module2_brain/registry.json');
  if (!res.ok) throw new Error("Graph Execution Faulted: Registry unavailable natively.");
  
  const registry = await res.json();
  const batch = [];

  for (const agent of state.selectedAgents) {
    const definedAgent = registry.find(a => a.id === agent.id);
    if (!definedAgent) continue;

    // Constructs the rigid System constraint framing user textual inputs explicitly
    batch.push({
      agentId: agent.id,
      prompt: `${definedAgent.systemInstruction}\n\nDraft:\n${state.currentDraft}`
    });
  }

  // Bridging Engine strictly asynchronously avoiding UI lockup vectors
  const results = await llmClient.runAgentBatch(batch);
  return { agentOutputs: results };
}

/**
 * Node 3: Unifies explicitly executed outputs scaling explicitly resolving VRAM limitations
 */
async function synthesizeDraftNode(state) {
  console.log(`[LangGraph] Synthesis phase natively merging disparate constraints...`);
  
  let combinedOutput = "";
  for (const rawResponse of state.agentOutputs) {
    combinedOutput += `\n--- Output mapped explicitly from ${rawResponse.agentId} ---\n${rawResponse.result}\n`;
  }

  // Absolute logic override natively extracting final logic mathematically limiting context bleed
  const synthPrompt = `You are the Synthesizer. Merge these Agent outputs into a single, perfect prompt based on the original request. Do not contradict them. Output ONLY the final prompt text.\n\nOriginal Request:\n${state.originalPrompt}\n\nDerived Agent Outputs:${combinedOutput}`;

  // Route back out sequentially directly executing safely mapping array resolutions
  const mergedResult = await llmClient.runAgentBatch([{ 
    agentId: 'agt_synth', 
    prompt: synthPrompt 
  }]);

  return { currentDraft: mergedResult[0].result };
}


// ==========================================
// 3. COMPILE GRAPH TOPOLOGY
// ==========================================

const workflow = new StateGraph(GraphState)
  .addNode("router", routePromptNode)
  .addNode("executor", executeAgentsNode)
  .addNode("synthesizer", synthesizeDraftNode)
  .addEdge(START, "router")
  .addEdge("router", "executor")
  .addEdge("executor", "synthesizer")
  .addEdge("synthesizer", END);

// Compile explicitly caching execution logic structurally mapping constraints
const promptOrchestrator = workflow.compile();


// ==========================================
// 4. EXPORTED INVOCATION WRAPPER
// ==========================================

/**
 * Triggerable entry point strictly insulating graph executions natively exposing single Promise vectors sequentially.
 * 
 * @param {string} rawInput 
 * @returns {Promise<string>} The newly synthesized perfect prompt seamlessly iteratively processed
 */
export async function processUserPrompt(rawInput) {
  const cleanInput = sanitizeInput(rawInput);
  
  // Seed the internal mathematical pipeline state natively
  const initialState = {
    originalPrompt: cleanInput,
    currentDraft: cleanInput,
    selectedAgents: [],
    agentOutputs: []
  };

  // LangGraph implicitly traverses state dictionaries propagating structural loops completely
  const finalMappedState = await promptOrchestrator.invoke(initialState);
  
  return finalMappedState.currentDraft;
}
