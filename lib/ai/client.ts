import { createOpenAI } from "@ai-sdk/openai";

let cachedClient: ReturnType<typeof createOpenAI> | null = null;

export function getOpenAIClient() {
  if (cachedClient !== null) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  cachedClient = createOpenAI({ apiKey });
  return cachedClient;
}
