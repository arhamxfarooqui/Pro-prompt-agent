/**
 * Agent Loop Controller
 * Orchestrates the Draft → Score → Refactor cycle.
 * - Passes critique from Scorer back to Refactor on subsequent iterations (self-correction)
 * - Uses profile-specific ScoringGuidelines.md for evaluation
 * - Target score: 75 (per FRD)
 * - Circuit breaker: max 3 iterations
 */

import { scorePrompt } from './scorer';
import { refactorPrompt } from './refactor';

export const TARGET_SCORE = 75;
export const MAX_ITERATIONS = 3;

export async function runRefactorLoop(
  userPrompt: string,
  profileContext?: string,
  profileGuidelines?: string,
  scoringGuidelinesMd?: string,
): Promise<{
  originalPrompt: string;
  refinedPrompt: string;
  score: number;
  iterations: number;
  critique: string;
  provider: string;
  latencyMs: number;
  tokensUsed: number;
}> {
  let currentPrompt = userPrompt;
  let iterations = 0;
  let lastScore = 0;
  let lastCritique = '';

  let totalLatency = 0;
  let totalTokens = 0;
  let lastProvider = 'groq';

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Step 1: Refactor — pass prior critique on iterations 2+
    console.log(`[Loop Controller] Iteration ${iterations}: Refactoring...`);
    const refactored = await refactorPrompt(
      currentPrompt,
      profileContext,
      profileGuidelines,
      iterations > 1 ? lastCritique : undefined,  // Self-correction feedback
    );
    currentPrompt = refactored.text;
    totalLatency += refactored.latencyMs;
    totalTokens += refactored.tokensUsed || 0;
    lastProvider = refactored.provider;

    // Step 2: Score — use profile scoring guidelines
    console.log(`[Loop Controller] Iteration ${iterations}: Scoring...`);
    const scoreRes = await scorePrompt(currentPrompt, scoringGuidelinesMd);
    lastScore = scoreRes.score;
    lastCritique = scoreRes.critique;
    lastProvider = scoreRes.provider;
    totalLatency += scoreRes.latencyMs;
    totalTokens += scoreRes.tokensUsed || 0;

    console.log(`[Loop Controller] Score: ${lastScore}/100. Critique: "${lastCritique}"`);

    // Circuit breaker: stop early if we hit the target
    if (lastScore >= TARGET_SCORE) {
      console.log(`[Loop Controller] Target score ${TARGET_SCORE} reached at iteration ${iterations}.`);
      break;
    }
  }

  console.log(`[Loop Controller] Finished. Final score: ${lastScore}/100 after ${iterations} iteration(s).`);

  return {
    originalPrompt: userPrompt,
    refinedPrompt: currentPrompt,
    score: lastScore,
    iterations,
    critique: lastCritique,
    provider: lastProvider,
    latencyMs: totalLatency,
    tokensUsed: totalTokens,
  };
}
