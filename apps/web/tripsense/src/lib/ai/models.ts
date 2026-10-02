export const DEFAULT_CHAT_MODEL = "gemini-3.6-flash";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge?: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "google",
    description: "Model thế hệ mới nhất • Suy luận sâu và phân tích mạnh",
    badge: "Mới nhất",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    provider: "google",
    description: "Cực kỳ ổn định • Cân bằng tốc độ và chất lượng",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "google",
    description: "Phản hồi siêu tốc • Khuyên dùng cho hội thoại mượt",
    badge: "Khuyên dùng",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    description: "Mô hình siêu nhẹ, trả lời nhanh các câu hỏi ngắn",
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
];
