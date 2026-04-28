/**
 * Scorer Agent — Deterministic scoring evaluation
 * Uses active profile's ScoringGuidelines.md for per-persona criteria.
 */

import { routeInference } from '@lib/adapters/llm-router';

export async function scorePrompt(
  prompt: string,
  scoringGuidelinesMd?: string,
): Promise<{
  score: number;
  critique: string;
  provider: string;
  latencyMs: number;
  tokensUsed?: number;
}> {
  const guidelinesSection = scoringGuidelinesMd
    ? `\n\n--- PROFILE SCORING CRITERIA (use these, not generic criteria) ---\n${scoringGuidelinesMd}`
    : `\n\n--- DEFAULT SCORING CRITERIA ---\n- Intent Clarity (40%): Is the primary goal unambiguous?\n- Constraint Rigidity (30%): Are boundaries, formatting, and edge cases explicitly defined?\n- Persona/Role Alignment (30%): Is the requested role explicitly clear and useful?`;

  const systemPrompt = `You are a deterministic prompt quality evaluator. Score the provided prompt on a scale of 0 to 100.${guidelinesSection}

You MUST respond with ONLY a valid JSON object — no markdown, no backticks, no explanation text before or after.
The JSON must have exactly two keys: "score" (integer 0-100) and "critique" (a single sentence explaining the main weakness).

EXAMPLE of correct output format:
{"score": 72, "critique": "The prompt lacks explicit output format constraints and does not specify the target audience level."}

EXAMPLE of correct output format:
{"score": 88, "critique": "Strong prompt with clear intent, though edge cases around null inputs are not addressed."}`;

  const response = await routeInference({
    systemPrompt,
    userPrompt: `Score this prompt:\n\n${prompt}`,
    maxTokens: 300,
    temperature: 0.3,
  });

  try {
    const rawContent = response.content.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!rawContent) {
      console.error('[Scorer] Empty response from LLM. Provider:', response.provider);
      throw new Error('Empty model output');
    }

    // Extract JSON object robustly
    const match = rawContent.match(/\{[\s\S]*?\}/);
    let cleanJson = match ? match[0] : rawContent;

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      // Self-healing: try to close truncated JSON
      if (!cleanJson.endsWith('"') && !cleanJson.endsWith('}')) cleanJson += '"';
      if (!cleanJson.endsWith('}')) cleanJson += '}';
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        // Last resort: regex extract score number from any text
        const scoreMatch = rawContent.match(/(?:"?score"?\s*:\s*)?(\d{1,3})/i);
        const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1], 10)) : 50;
        const critiqueMatch = rawContent.match(/(?:"?critique"?\s*:\s*"?)([^"}{]+)/i);
        const critique = critiqueMatch ? critiqueMatch[1].trim() : 'Could not parse detailed critique.';
        return { score, critique, provider: response.provider, latencyMs: response.latencyMs, tokensUsed: response.tokensUsed };
      }
    }

    return {
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : parseInt(parsed.score, 10) || 50,
      critique: parsed.critique || 'No critique provided.',
      provider: response.provider,
      latencyMs: response.latencyMs,
      tokensUsed: response.tokensUsed,
    };
  } catch (error) {
    console.error('[Scorer] Parsing failed, using fallback.', error, 'Raw:', response.content?.slice(0, 200));
    return {
      score: 50,
      critique: 'Could not parse LLM response. Check your model provider and API key.',
      provider: response.provider,
      latencyMs: response.latencyMs,
      tokensUsed: response.tokensUsed,
    };
  }
}
