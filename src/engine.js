import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";

export async function initializeLLM() {
  const initProgressCallback = (report) => {
    console.log("LLM Download Progress:", report.text);
  };

  // Create engine and strictly cap VRAM usage via context window limitations
  const engine = await CreateMLCEngine(
    "gemma-2b-it-q4f16_1-MLC",
    {
      initProgressCallback: initProgressCallback,
      context_window_size: 1024,
      sliding_window_size: 1024,
    }
  );

  return engine;
}

export class LocalWebLLMBridge extends BaseChatModel {
  constructor(engine) {
    super({});
    this.engine = engine;
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

    const completion = await this.engine.chat.completions.create({
      messages: formattedMessages
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
