/**
 * Comprehension Agent — Condenses raw webpage context into concise knowledge
 */

import { routeInference } from '@lib/adapters/llm-router';

export async function comprehendContext(rawText: string): Promise<string> {
  const systemPrompt = `You are a critical knowledge extractor. The user will provide raw, potentially noisy text from a webpage or selection.
Your job is to condense this into purely factual, highly dense contextual information.
Rules:
- Remove all fluff, formatting artifacts, and conversational text.
- Preserve hard facts, code blocks, exact definitions, and specific constraints.
- Output a structured summary (bullet points if applicable).
- Do NOT hallucinate. Do NOT add information not present in the source text.`;

  const response = await routeInference({
    systemPrompt,
    userPrompt: `Extract key context from this raw text:\n\n${rawText}`,
    maxTokens: 1024,
    temperature: 0.2, // Very low temperature to prevent hallucination
  });

  return response.content.trim();
}