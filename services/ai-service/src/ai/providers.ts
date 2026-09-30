import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { config } from "../config.js";
import { getModelConfig } from "./models.js";
import { geminiKeyManager } from "./gemini-key-manager.js";

// Cache Google Generative AI provider instances by apiKey
const googleProviderCache = new Map<string, ReturnType<typeof createGoogleGenerativeAI>>();

function getGoogleProvider(apiKey: string) {
  let provider = googleProviderCache.get(apiKey);
  if (!provider) {
    provider = createGoogleGenerativeAI({ apiKey });
    googleProviderCache.set(apiKey, provider);
  }
  return provider;
}

// Initialize OpenAI provider (with optional custom baseURL)
const openai = createOpenAI({
  apiKey: config.openaiApiKey,
  baseURL: config.openaiBaseUrl ? config.openaiBaseUrl : undefined,
});

/**
 * Resolves LanguageModel along with provider and active key metadata
 */
export async function resolveLanguageModel(modelId: string) {
  const modelConfig = getModelConfig(modelId);

  if (modelConfig.provider === "openai") {
    return {
      model: openai(modelConfig.id),
      provider: "openai" as const,
      activeKey: config.openaiApiKey,
    };
  }

  // Dynamic Google Gemini provider
  const activeKey = await geminiKeyManager.getActiveKey();
  const google = getGoogleProvider(activeKey);
  return {
    model: google(modelConfig.id),
    provider: "google" as const,
    activeKey,
  };
}

/**
 * Factory returning LanguageModel for the given model ID
 */
export async function getLanguageModel(modelId: string) {
  const resolved = await resolveLanguageModel(modelId);
  return resolved.model;
}

