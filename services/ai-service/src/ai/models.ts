export interface SupportedModel {
  id: string;
  name: string;
  provider: "google" | "openai";
  description: string;
  badge?: string;
  isDefault?: boolean;
}

export const DEFAULT_MODEL_ID = "gemini-3.6-flash";

export const SUPPORTED_MODELS: SupportedModel[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "google",
    description: "Model thế hệ mới nhất • Suy luận sâu và tốc độ siêu nhanh",
    badge: "Mặc định",
    isDefault: true,
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    provider: "google",
    description: "Cực kỳ ổn định • Cân bằng tốc độ và chất lượng",
    badge: "Phổ biến",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "google",
    description: "Phiên bản tiền nhiệm ổn định cao",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    description: "Mô hình siêu nhẹ cho hội thoại nhanh",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    provider: "google",
    description: "Bản rút gọn siêu tiết kiệm token, tốc độ cao",
    badge: "Tiết kiệm",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    provider: "google",
    description: "Bản Lite phản hồi cực nhanh, độ trễ tối thiểu",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Mô hình nhỏ gọn, thông minh từ OpenAI",
    badge: "OpenAI",
  },
];

export function getModelConfig(modelId: string): SupportedModel {
  return SUPPORTED_MODELS.find((m) => m.id === modelId) || SUPPORTED_MODELS[0];
}
