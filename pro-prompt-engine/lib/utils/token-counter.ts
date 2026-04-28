/**
 * Token Counter — gpt-tokenizer integration
 *
 * Uses the `gpt-tokenizer` library for accurate BPE token counting.
 * Enforces the 4000-token limit on Context.md per FRD.
 *
 * Why gpt-tokenizer:
 * - Accurate BPE tokenization (same algorithm as OpenAI/LLaMA tokenizers)
 * - ~15KB gzipped, browser-safe, zero dependencies
 * - WASM-free — pure JS, no polyfill issues in MV3 service workers
 */

import { encode } from 'gpt-tokenizer';

/** Maximum tokens allowed in a Context.md file */
export const MAX_CONTEXT_TOKENS = 4000;

/**
 * Count the number of BPE tokens in the given text.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

/**
 * Truncate text to fit within `maxTokens` using FIFO strategy.
 * Removes content from the beginning to preserve the most recent context.
 *
 * @param text - The full text to truncate
 * @param maxTokens - Token budget (default: MAX_CONTEXT_TOKENS)
 * @returns The truncated text and the number of tokens dropped
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number = MAX_CONTEXT_TOKENS,
): { truncated: string; tokenCount: number; droppedTokens: number } {
  const tokens = encode(text);

  if (tokens.length <= maxTokens) {
    return { truncated: text, tokenCount: tokens.length, droppedTokens: 0 };
  }

  // FIFO: keep the LAST `maxTokens` tokens (most recent context)
  const droppedTokens = tokens.length - maxTokens;
  const kept = tokens.slice(droppedTokens);

  // Decode back to text — approximate by splitting on section separators
  // Since gpt-tokenizer doesn't export `decode`, we use a paragraph-boundary approach
  const sections = text.split(/\n---\n/);
  let result = '';
  let runningTokens = 0;

  // Build from the END (most recent sections first)
  for (let i = sections.length - 1; i >= 0; i--) {
    const sectionTokens = encode(sections[i]).length;
    if (runningTokens + sectionTokens > maxTokens) break;
    result = sections[i] + (result ? '\n---\n' + result : '');
    runningTokens += sectionTokens;
  }

  return {
    truncated: result || text.slice(-maxTokens * 4), // fallback: ~4 chars per token
    tokenCount: countTokens(result),
    droppedTokens,
  };
}

/**
 * Check if a text exceeds the context token limit.
 */
export function exceedsContextLimit(text: string): boolean {
  return countTokens(text) > MAX_CONTEXT_TOKENS;
}

/**
 * Get a rough token estimate (fast path, no BPE).
 * Useful for real-time UI feedback where accuracy isn't critical.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
