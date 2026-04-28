/**
 * PII Scrubber — Regex-based redaction for sensitive data
 *
 * Applied BEFORE any prompt leaves the browser for Groq cloud.
 * WebGPU & Ollama are local, so they bypass this.
 */

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL_REDACTED]', label: 'email' },
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: '[SSN_REDACTED]', label: 'ssn' },
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[CC_REDACTED]', label: 'credit_card' },
  { pattern: /\b\d{10,12}\b/g, replacement: '[PHONE_REDACTED]', label: 'phone' },
  { pattern: /(?:sk-|gsk_|ghp_|glpat-|xoxb-|xoxp-)[A-Za-z0-9_-]{20,}/g, replacement: '[API_KEY_REDACTED]', label: 'api_key' },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g, replacement: '[PRIVATE_KEY_REDACTED]', label: 'private_key' },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]+/gi, replacement: '[PASSWORD_REDACTED]', label: 'password' },
];

export function scrubPII(text: string): { cleaned: string; detected: string[] } {
  let cleaned = text;
  const detected: string[] = [];
  for (const { pattern, replacement, label } of PII_PATTERNS) {
    const matches = cleaned.match(pattern);
    if (matches) {
      detected.push(label);
      cleaned = cleaned.replace(pattern, replacement);
    }
  }
  return { cleaned, detected };
}

export function hasPII(text: string): boolean {
  return PII_PATTERNS.some(({ pattern }) => pattern.test(text));
}
