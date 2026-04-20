/**
 * src/module2_brain/orchestrator.js
 * Input Security & Sanitization Layer
 */

/**
 * Strips malicious HTML tags and flags prompt injection payloads.
 * @param {string} rawText The untrusted user input
 * @returns {string} The cleaned, safe string
 */
export function sanitizeInput(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  
  let cleanText = rawText;

  // 1. XSS Protection: Aggressively strip specific malicious HTML tags and handlers
  cleanText = cleanText.replace(/<\/?(script|iframe).*?>/gi, "");
  cleanText = cleanText.replace(/onload\s*=/gi, "");
  cleanText = cleanText.replace(/onerror\s*=/gi, "");

  // 2. Prompt Injection Guard: Flag and neutralize common jailbreaks
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
