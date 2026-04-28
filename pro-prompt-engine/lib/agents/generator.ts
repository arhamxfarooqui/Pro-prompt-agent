/**
 * Generator Agent — Creates robust prompts from simple descriptions
 */

import { routeInference } from '@lib/adapters/llm-router';

export async function generatePrompt(
  description: string,
  verbosity: number = 0.5,
  profileContext?: string,
  profileGuidelines?: string
): Promise<{ text: string; provider: string; latencyMs: number; tokensUsed?: number }> {
  let detailLevelGuidance = 'Moderate detail with a clear structure.';
  if (verbosity > 0.7) {
    detailLevelGuidance = 'VERBOSE: Include extensive context, examples, edge cases, and highly granular step-by-step instructions.';
  } else if (verbosity < 0.3) {
    detailLevelGuidance = 'CONCISE: Direct, minimalist, and to the point. Strip all non-essential wording.';
  }

  let systemPrompt = `You are an expert prompt engineer. Generate a production-ready prompt based on the user's brief description.
Style directive: ${detailLevelGuidance}

Output ONLY the generated prompt text. Do not include commentary, explanations, or introductory text.`;

  if (profileGuidelines) {
    systemPrompt += `\n\n--- Profile Guidelines ---\n${profileGuidelines}`;
  }
  
  if (profileContext) {
    systemPrompt += `\n\n--- Knowledge Context ---\n${profileContext}`;
  }

  const response = await routeInference({
    systemPrompt,
    userPrompt: `Generate a highly effective prompt for the following task description:\n\n${description}`,
    maxTokens: verbosity > 0.7 ? 2048 : 1024,
    temperature: 0.6,
  });

  return {
    text: response.content.trim(),
    provider: response.provider,
    latencyMs: response.latencyMs,
    tokensUsed: response.tokensUsed,
  };
}
