import { MLCEngine } from "@mlc-ai/web-llm";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";

export class LLMManager {
  constructor() {
    this.engine = null;
  }

  async initEngine() {
    this.engine = new MLCEngine();
    this.engine.setInitProgressCallback((progress) => {
      chrome.runtime.sendMessage({ type: 'DOWNLOAD_PROGRESS', data: progress });
    });
  }

  async loadGemmaModel() {
    // IndexedDB caching is enabled by default in WebLLM
    await this.engine.reload("gemma-2-2b-it-q4f16_1-MLC", {
      context_window_size: 2048,
      sliding_window_size: 2048,
    });
  }
}

export class LocalWebLLMBridge extends BaseChatModel {
  constructor(llmManager) {
    super({});
    this.llmManager = llmManager;
  }

  _llmType() {
    return "local_web_llm";
  }

  async _generate(messages, options, runManager) {
    const formattedMessages = messages.map(msg => {
      let role = "user";
      const type = msg._getType();
      
      if (type === "system") {
        role = "system";
      } else if (type === "ai") {
        role = "assistant";
      }

      return {
        role: role,
        content: msg.content
      };
    });

    const completion = await this.llmManager.engine.chat.completions.create({
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 2048
    });

    const responseContent = completion.choices[0].message.content;

    return {
      generations: [
        {
          text: responseContent,
          message: new AIMessage(responseContent)
        }
      ]
    };
  }
}
