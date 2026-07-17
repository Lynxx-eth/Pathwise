// Picks the AI provider based on env. Import `ai` anywhere you need AI.
import { env } from "../lib/env.js";
import type { AIProvider } from "./types.js";
import { MockAIProvider } from "./mock.js";
import { OpenAIProvider } from "./openai.js";

function createProvider(): AIProvider {
  if (env.AI_PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY) {
      console.warn(
        "⚠️  AI_PROVIDER=openai but OPENAI_API_KEY is empty — falling back to mock."
      );
      return new MockAIProvider();
    }
    return new OpenAIProvider();
  }
  return new MockAIProvider();
}

export const ai: AIProvider = createProvider();
export type { AIProvider } from "./types.js";
