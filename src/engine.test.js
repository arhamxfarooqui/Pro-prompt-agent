import { jest } from '@jest/globals';

// We must use unstable_mockModule for Native ESM environment BEFORE importing the system under test
const mockEngine = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Mocked dummy response'
            }
          }
        ]
      })
    }
  }
};

const CreateMLCEngineMock = jest.fn().mockResolvedValue(mockEngine);

jest.unstable_mockModule('@mlc-ai/web-llm', () => {
  return {
    CreateMLCEngine: CreateMLCEngineMock
  };
});

// Dynamically import to ensure modules are required AFTER the mock is configured
const { initializeLLM, LocalWebLLMBridge } = await import('./engine.js');
const { SystemMessage, HumanMessage, AIMessage } = await import('@langchain/core/messages');
const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

describe('WebLLM Engine Module', () => {
  let mockEngine;

  beforeEach(() => {
    // Reset mocks before each test to guarantee independent test runs
    jest.clearAllMocks();

    // Create a fake engine object with mock chat.completions.create method resolving to dummy output
    mockEngine = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Mocked dummy response'
                }
              }
            ]
          })
        }
      }
    };

    // Setup CreateMLCEngine to resolve with the fake engine object
    CreateMLCEngine.mockResolvedValue(mockEngine);
  });

  describe('initializeLLM', () => {
    it('should call CreateMLCEngine with the correct model ID and VRAM capping configurations', async () => {
      const engine = await initializeLLM();
      
      expect(CreateMLCEngine).toHaveBeenCalledTimes(1);
      
      // Verify correct model ID and object parameters specifically context_window_size
      expect(CreateMLCEngine).toHaveBeenCalledWith(
        'gemma-2b-it-q4f16_1-MLC',
        expect.objectContaining({
          context_window_size: 1024,
          initProgressCallback: expect.any(Function)
        })
      );
      
      // Assure the returned engine instance matches the generated fake engine
      expect(engine).toBe(mockEngine);
    });
  });

  describe('LocalWebLLMBridge', () => {
    it('should format LangChain messages, call mock engine, and accurately parse the ChatResult', async () => {
      // Instantiate our custom bridge class providing the dummy engine
      const bridge = new LocalWebLLMBridge(mockEngine);
      
      // Generate array of LangChain messages containing one SystemMessage and one HumanMessage
      const messages = [
        new SystemMessage('You are a helpful assistant.'),
        new HumanMessage('Hello, how are you?')
      ];

      const result = await bridge._generate(messages);

      // 1. Verify the _generate method properly forwarded the correctly formatted standard schema
      expect(mockEngine.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, how are you?' }
        ]
      });

      // 2. Map and parse the returned results successfully verifying standard ChatResult outline
      expect(result.generations).toBeDefined();
      expect(result.generations.length).toBe(1);
      
      const generation = result.generations[0];
      
      // 3. Ensuring parsed result includes an actual AIMessage instance directly
      expect(generation.text).toBe('Mocked dummy response');
      expect(generation.message).toBeInstanceOf(AIMessage);
      expect(generation.message.content).toBe('Mocked dummy response');
    });
  });
});
