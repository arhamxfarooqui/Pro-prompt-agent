/**
 * Content Script for Pro-prompt-agent
 * Phase 1.3: The Context Extractor
 */

/**
 * List of CSS selectors for elements that should be ignored during text extraction
 * to save tokens for the LLM context.
 * @type {string[]}
 */
const ELEMENTS_TO_IGNORE = [
  'script',
  'style',
  'nav',
  'footer',
  'noscript'
];

/**
 * Cleans up extracted text by removing excessive whitespaces and empty lines.
 * @param {string} text - The raw extracted text.
 * @returns {string} The cleaned text.
 */
const cleanExtractedText = (text) => {
  if (!text) return '';
  return text
    // Replace multiple spaces and horizontal tabs with a single space
    .replace(/[ \t]+/g, ' ')
    // Replace multiple carriage returns/newlines with a single newline
    .replace(/[\r\n]+/g, '\n')
    // Remove extra spaces around newlines
    .replace(/\n /g, '\n')
    .replace(/ \n/g, '\n')
    // Final trim to remove leading/trailing whitespace
    .trim();
};

/**
 * Extracts the main readable text from the current webpage.
 * It ignores specific elements like navigation, footer, and scripts to focus on main content.
 * @returns {string} The extracted, cleaned readable text.
 */
const extractPageContext = () => {
  // Clone the document body to avoid modifying the live webpage DOM
  const bodyClone = document.body.cloneNode(true);

  // Remove unwanted elements to reduce token usage and isolate main content
  const elementsToRemove = bodyClone.querySelectorAll(ELEMENTS_TO_IGNORE.join(', '));
  elementsToRemove.forEach(el => el.remove());

  // Extract raw text content. We use textContent as innerText may behave
  // inconsistently on disconnected DOM nodes.
  const rawText = bodyClone.textContent || '';

  // Clean and return the extracted text
  return cleanExtractedText(rawText);
};

/**
 * Handles incoming messages from the extension toolkit (e.g., background script, popup).
 * Listens specifically for the 'EXTRACT_PAGE_CONTEXT' action.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_PAGE_CONTEXT') {
    
    // Execute the extraction process asynchronously
    Promise.resolve().then(() => {
      try {
        const text = extractPageContext();
        // Send the cleaned text back in the response
        sendResponse({ success: true, text });
      } catch (error) {
        console.error('Pro-prompt-agent: Error extracting page context:', error);
        sendResponse({ success: false, error: error.message });
      }
    });

    // Return true to indicate that the response will be sent asynchronously
    // This keeps the message channel open until sendResponse is called
    return true;
  }
  
  // Implicitly or explicitly return false for other unrecognized actions
  return false;
});
