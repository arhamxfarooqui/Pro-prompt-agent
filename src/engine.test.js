import { jest } from '@jest/globals';

const mockEngine = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Mocked dummy response' }
        }]
      })
    }
  },
  setInitProgressCallback: jest.fn(),
  reload: jest.fn().mockResolvedValue(undefined)
};

const MLCEngineMock = jest.fn().mockImplementation(() => mockEngine);

jest.unstable_mockModule('@mlc-ai/web-llm', () => {
  return {
    MLCEngine: MLCEngineMock
  };
});

const { LLMManager, LocalWebLLMBridge } = await import('./engine.js');
const { SystemMessage, HumanMessage, AIMessage } = await import('@langchain/core/messages');
const { MLCEngine } = await import('@mlc-ai/web-llm');

describe('WebLLM Engine Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockEngine.chat.completions.create.mockResolvedValue({
      choices: [{
        message: { content: 'Mocked dummy response' }
      }]
    });
    mockEngine.reload.mockResolvedValue(undefined);
    MLCEngineMock.mockClear();
    
    global.chrome = {
      runtime: {
        sendMessage: jest.fn()
      }
    };
  });

  describe('LLMManager', () => {
    it('should initialize MLCEngine and set progress callback', async () => {
      const manager = new LLMManager();
      await manager.initEngine();
      
      expect(MLCEngineMock).toHaveBeenCalledTimes(1);
      expect(manager.engine).toBe(mockEngine);
      expect(mockEngine.setInitProgressCallback).toHaveBeenCalledTimes(1);
      
      const callback = mockEngine.setInitProgressCallback.mock.calls[0][0];
      callback({ text: 'Downloading', progress: 0.5 });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DOWNLOAD_PROGRESS',
        data: { text: 'Downloading', progress: 0.5 }
      });
    });

    it('should load gemma model with WebGPU context caps', async () => {
      const manager = new LLMManager();
      manager.engine = mockEngine; 
      
      await manager.loadGemmaModel();
      
      expect(mockEngine.reload).toHaveBeenCalledTimes(1);
      expect(mockEngine.reload).toHaveBeenCalledWith(
        'gemma-2-2b-it-q4f16_1-MLC',
        expect.objectContaining({
          context_window_size: 2048,
          sliding_window_size: 2048
        })
      );
    });
  });

  describe('LocalWebLLMBridge', () => {
    it('should format LangChain messages, call mock engine, and accurately parse the ChatResult', async () => {
      const manager = new LLMManager();
      manager.engine = mockEngine;
      const bridge = new LocalWebLLMBridge(manager);
      
      const messages = [
        new SystemMessage('You are a helpful assistant.'),
        new HumanMessage('Hello, how are you?')
      ];

      const result = await bridge._generate(messages);

      expect(mockEngine.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, how are you?' }
        ],
        temperature: 0.7,
        max_tokens: 2048
      });

      expect(result.generations).toBeDefined();
      expect(result.generations.length).toBe(1);
      
      const generation = result.generations[0];
      
      expect(generation.text).toBe('Mocked dummy response');
      expect(generation.message).toBeInstanceOf(AIMessage);
      expect(generation.message.content).toBe('Mocked dummy response');
    });
  });
});
