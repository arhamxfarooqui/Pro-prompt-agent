/**
 * Refactor Agent — Improves prompts using profile context, guidelines, and prior critique.
 */

import { routeInference } from '@lib/adapters/llm-router';

export async function refactorPrompt(
  prompt: string,
  profileContext?: string,
  profileGuidelines?: string,
  critique?: string,  // Feedback from prior Scorer iteration
): Promise<{ text: string; provider: string; latencyMs: number; tokensUsed?: number }> {
  let systemPrompt = `You are an expert prompt engineer. Your job is to refactor user prompts into clear, structured, high-quality prompts.

Rules:
1. Maintain the user's original intent — do NOT change what they want to achieve.
2. Add clear structure (numbered steps, sections, or bullet points where appropriate).
3. Specify output format explicitly if it is implicit.
4. Add robust constraints to prevent hallucination and off-topic responses.
5. Use precise, unambiguous language. Remove filler words.
6. Assign an expert role/persona if the task benefits from one.

Output ONLY the refactored prompt text. Do not include commentary, meta-text like "Here is the refactored prompt:", or any explanation.`;

  if (profileGuidelines) {
    systemPrompt += `\n\n--- PROFILE GUIDELINES (incorporate these principles) ---\n${profileGuidelines}`;
  }

  if (profileContext) {
    systemPrompt += `\n\n--- PROFILE KNOWLEDGE CONTEXT (use this as background knowledge) ---\n${profileContext}`;
  }

  if (critique) {
    systemPrompt += `\n\n--- PRIOR ITERATION CRITIQUE (fix these specific issues in your refactoring) ---\n${critique}`;
  }

  const userMessage = critique
    ? `Refactor this prompt. Pay close attention to the critique above and specifically address those weaknesses:\n\n${prompt}`
    : `Refactor and dramatically improve the following prompt:\n\n${prompt}`;

  const response = await routeInference({
    systemPrompt,
    userPrompt: userMessage,
    maxTokens: 2000,
    temperature: 0.5,
  });

  const text = response.content.trim();

  return {
    text: text || prompt, // Fallback to original if empty
    provider: response.provider,
    latencyMs: response.latencyMs,
    tokensUsed: response.tokensUsed,
  };
}
