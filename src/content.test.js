import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup full global mocks for the Chrome Extension APIs and DOM
const mockSendResponse = jest.fn();
const mockOnMessageAddListener = jest.fn();

global.chrome = {
  runtime: {
    onMessage: {
      addListener: mockOnMessageAddListener
    }
  }
};

// Create a pseudo-DOM node for elements that get removed
const createMockElement = (tag) => ({
  tagName: tag.toUpperCase(),
  remove: jest.fn()
});

// We'll mutate this variable per test to simulate different text contents
let mockTextContent = '  Standard   Text  \n \n More text.  ';
let mockElementsToRemove = [];

const mockQuerySelectorAll = jest.fn(() => mockElementsToRemove);

const mockCloneNode = jest.fn(() => ({
  querySelectorAll: mockQuerySelectorAll,
  get textContent() {
    return mockTextContent;
  }
}));

global.document = {
  body: {
    cloneNode: mockCloneNode
  }
};

describe('Context Extractor (Phase 1.3)', () => {
  beforeAll(() => {
    jest.clearAllMocks();
    // Read the script natively to simulate browser execution context without ES caching
    const scriptContent = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf-8');
    eval(scriptContent);
  });

  it('should register runtime message listener on execution', () => {
    expect(mockOnMessageAddListener).toHaveBeenCalledTimes(1);
  });

  it('should ignore other messages and return false', () => {
    const listenerCallback = mockOnMessageAddListener.mock.calls[0][0];
    const result = listenerCallback({ action: 'UNKNOWN_ACTION' }, {}, mockSendResponse);
    expect(result).toBe(false);
  });

  it('should asynchronously process EXTRACT_PAGE_CONTEXT and format text', async () => {
    const listenerCallback = mockOnMessageAddListener.mock.calls[0][0];
    
    // Set up mock DOM state for the test
    mockTextContent = `
       This   is 
       a    test 
       with   excessive 
       
       whitespaces.   
    `;
    const scriptEl = createMockElement('script');
    const navEl = createMockElement('nav');
    mockElementsToRemove = [scriptEl, navEl];
    
    const result = listenerCallback({ action: 'EXTRACT_PAGE_CONTEXT' }, {}, mockSendResponse);
    
    // Returning true maintains the async message channel
    expect(result).toBe(true);
    
    // We must wait for the microtask queue to process because internal logic uses Promise.resolve().then()
    await Promise.resolve();

    // Verification of DOM interactions
    expect(mockCloneNode).toHaveBeenCalledWith(true);
    expect(mockQuerySelectorAll).toHaveBeenCalledWith('script, style, nav, footer, noscript');
    
    expect(scriptEl.remove).toHaveBeenCalledTimes(1);
    expect(navEl.remove).toHaveBeenCalledTimes(1);
    
    // Verification of the text cleaning
    expect(mockSendResponse).toHaveBeenCalledTimes(1);
    const responsePayload = mockSendResponse.mock.calls[0][0];
    
    expect(responsePayload.success).toBe(true);
    // Based on the cleanExtractedText logic, it should look somewhat unified:
    expect(responsePayload.text).toBe('This is\na test\nwith excessive\n\nwhitespaces.');
  });
});
