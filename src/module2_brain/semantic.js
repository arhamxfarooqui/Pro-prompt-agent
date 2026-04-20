/**
 * src/module2_brain/semantic.js
 * The Vector Semantic Engine using Transformers.js natively.
 */

import { pipeline, env } from '@xenova/transformers';

// Prevents downloading models from local file system in browser environments
env.allowLocalModels = false;

// Global RAM cache
let extractorPipeline = null;
let agentCache = []; // Stores { id, name, vector }

/**
 * Initializes the Transformers.js feature extraction pipeline.
 * Reads registry.json and caches the resulting Float32Array vectors in RAM.
 */
export async function initSemanticEngine() {
  try {
    console.log("[Semantic Engine] Loading all-MiniLM-L6-v2 pipeline...");
    
    // Feature extraction automatically caches the model within the browser storage
    extractorPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    const res = await fetch('/src/module2_brain/registry.json');
    if (!res.ok) throw new Error("Failed to load registry.json");
    
    const registry = await res.json();
    console.log(`[Semantic Engine] Vectorizing ${registry.length} agents...`);

    // Cache [agentId, embeddingVector] pairs in RAM
    for (const agent of registry) {
      const vector = await generateEmbedding(agent.description);
      agentCache.push({ 
        id: agent.id, 
        name: agent.name, 
        vector: vector 
      });
    }

    console.log("[Semantic Engine] Vectors cached cleanly.");
    return true;
  } catch (error) {
    console.error("Failed to initialize Semantic Engine:", error);
    return false;
  }
}

/**
 * Passes text through the loaded model and returns a dense numerical vector.
 * @param {string} text - Cleaned user prompt
 * @returns {Promise<Float32Array>} Dense vector
 */
export async function generateEmbedding(text) {
  if (!extractorPipeline) throw new Error("Pipeline not initialized. Call initSemanticEngine first.");
  
  // Transform the textual features natively mapping pooled tensors into flat arrays
  const output = await extractorPipeline(text, { pooling: 'mean', normalize: true });
  return output.data;
}

/**
 * Standard mathematical dot product over magnitude formula.
 * @param {Float32Array|number[]} vecA 
 * @param {Float32Array|number[]} vecB 
 * @returns {number} Geometric orientation similarity score (0 to 1)
 */
export function calculateCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates user embedding, compares against all cached agents, and returns the top dynamic routes.
 * @param {string} userPrompt - Clean user input
 * @param {number} maxAgents - Top matches to return (default: 2)
 * @returns {Promise<Array<{id: string, weight: number, name: string}>>} 
 */
export async function routePrompt(userPrompt, maxAgents = 2) {
  if (agentCache.length === 0) throw new Error("Agent cache is empty. Cannot route.");

  const promptVector = await generateEmbedding(userPrompt);
  const similarityScores = [];

  // Compare prompt against all cached Agent vectors
  for (const agent of agentCache) {
    const score = calculateCosineSimilarity(promptVector, agent.vector);
    similarityScores.push({
      id: agent.id,
      name: agent.name,
      score: score
    });
  }

  // Isolate highest scores descending
  similarityScores.sort((a, b) => b.score - a.score);
  const topAgents = similarityScores.slice(0, maxAgents);

  // Derive explicit fractional weightages so the sum natively scales to 1.0 (100%)
  const totalScore = topAgents.reduce((sum, item) => sum + item.score, 0);

  return topAgents.map(agent => ({
    id: agent.id,
    name: agent.name,
    weight: totalScore > 0 ? (agent.score / totalScore) : 0
  }));
}
