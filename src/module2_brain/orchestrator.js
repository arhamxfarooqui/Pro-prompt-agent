/**
 * src/module2_brain/orchestrator.js
 * Central LangGraph Orchestration Layer bridging Semantic Maps and Engine Workers
 * Features a standalone autonomous feedback loop iterating LLM pipelines until >75% bounds.
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { llmClient } from "../module1_engine/llm-client.js";
import { routePrompt } from "./semantic.js";

// ==========================================
// 0. INPUT SECURITY & SANITIZATION
// ==========================================

export function sanitizeInput(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  
  let cleanText = rawText;

  // XSS Protection stripping dangerous vectors natively
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

// Defining structural memory nodes dynamically supporting self-correcting recursion iteratively.
const GraphState = Annotation.Root({
  originalPrompt: Annotation(),
  currentDraft: Annotation(),
  selectedAgents: Annotation(),
  agentOutputs: Annotation(),
  externalContext: Annotation(),
  
  // Phase 2.3 Additions explicitly modeling iterative grading cycles
  currentScore: Annotation(),
  scoreReasoning: Annotation(),
  iteration: Annotation()
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
 * Node 2: Constructs VRAM safe sequential queues explicitly mapping logic out to engine modules safely.
 */
async function executeAgentsNode(state) {
  console.log(`[LangGraph] Execution phase dynamically processing agents on Iteration ${state.iteration}...`);
  
  const res = await fetch('/src/module2_brain/registry.json');
  if (!res.ok) throw new Error("Graph Execution Faulted: Registry unavailable natively.");
  
  const registry = await res.json();
  const batch = [];

  for (const agent of state.selectedAgents) {
    const definedAgent = registry.find(a => a.id === agent.id);
    if (!definedAgent) continue;

    batch.push({
      agentId: agent.id,
      prompt: `${definedAgent.systemInstruction}\n\nDraft:\n${state.currentDraft}`
    });
  }

  const results = await llmClient.runAgentBatch(batch);
  return { agentOutputs: results };
}

/**
 * Node 3: Unifies explicitly executed outputs scaling explicitly resolving VRAM limitations
 */
async function synthesizeDraftNode(state) {
  console.log(`[LangGraph] Synthesis phase natively merging disparate logic boundaries...`);
  
  let combinedOutput = "";
  for (const rawResponse of state.agentOutputs) {
    combinedOutput += `\n--- Output mapped explicitly from ${rawResponse.agentId} ---\n${rawResponse.result}\n`;
  }

  const ctx = state.externalContext || {};
  const tagsStr = (ctx.profileTags && ctx.profileTags.length > 0) ? ctx.profileTags.join(", ") : "None assigned";
  const pageStr = ctx.pageData || "No scrape generated.";

  const synthPrompt = `You are the Synthesizer. You must refine this prompt while strictly adhering to the user's Technical Profile and the provided Environmental Page Context.

Technical Profile constraints: [${tagsStr}]

Environmental Page Context (Target System Architecture natively):
${pageStr}

Original Request:
${state.originalPrompt}

Derived Agent Outputs:${combinedOutput}`;

  const mergedResult = await llmClient.runAgentBatch([{ 
    agentId: 'agt_synth', 
    prompt: synthPrompt 
  }]);

  return { currentDraft: mergedResult[0].result };
}

/**
 * Node 4: The Critic mapping dynamic string payloads evaluating geometric structural alignment internally via WebLLM bounds
 */
async function scoreDraftNode(state) {
  console.log(`[LangGraph] Scorer Node Evaluating Generated Protocol Iteration...`);
  const result = await llmClient.calculatePromptScore(state.currentDraft);
  
  return { 
    currentScore: result.score, 
    scoreReasoning: result.reasoning 
  };
}

/**
 * Node 5: Recalibration Injector pre-processing explicitly looping data parameters
 */
function recalibrateNode(state) {
  console.log(`[LangGraph] Grade (${state.currentScore}/100) necessitates Recalibration Sequence...`);
  
  const newDraft = `--- CRITIC FEEDBACK: YOU MUST FIX THIS ---\n${state.scoreReasoning}\n\n--- DRAFT TO FIX ---\n${state.currentDraft}`;
  
  return { 
    iteration: state.iteration + 1, 
    currentDraft: newDraft 
  };
}

/**
 * Conditional Edge Gate evaluating State variables resolving loop boundaries natively.
 */
function shouldRecalibrate(state) {
  // Graceful degradation capping computational bounds directly preventing unhalting limits globally.
  if (state.currentScore >= 75 || state.iteration >= 3) {
    console.log(`[LangGraph] Graph State satisfied successfully. Exiting structural limits natively.`);
    return "__end__";
  } else {
    return "recalibrate";
  }
}

// ==========================================
// 3. COMPILE GRAPH TOPOLOGY
// ==========================================

const workflow = new StateGraph(GraphState)
  .addNode("router", routePromptNode)
  .addNode("executor", executeAgentsNode)
  .addNode("synthesizer", synthesizeDraftNode)
  .addNode("scorer", scoreDraftNode)          // New Phase 2.3 integration
  .addNode("recalibrate", recalibrateNode)    // New Phase 2.3 integration
  .addEdge(START, "router")
  .addEdge("router", "executor")
  .addEdge("executor", "synthesizer")
  .addEdge("synthesizer", "scorer")
  .addConditionalEdges("scorer", shouldRecalibrate) // Conditional Gate routing recursively loops
  .addEdge("recalibrate", "executor");

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
export async function processUserPrompt(rawInput, externalContext = {}) {
  const cleanInput = sanitizeInput(rawInput);
  
  // Seed the internal mathematical pipeline state natively initiating loop memory
  const initialState = {
    originalPrompt: cleanInput,
    currentDraft: cleanInput,
    selectedAgents: [],
    agentOutputs: [],
    externalContext: externalContext, // Map external indexedDB dynamically properly automatically elegantly organically purely 
    currentScore: 0,         // New Init Limit
    scoreReasoning: "",      // New Init Value
    iteration: 1             // Seed counter cleanly mapping recursion limits
  };

  // LangGraph implicitly traverses state dictionaries propagating structural loops completely
  const finalMappedState = await promptOrchestrator.invoke(initialState);
  
  return finalMappedState.currentDraft;
}
