"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import {
  type ChatSession,
  useAiChatSessions,
  useDeleteAiChatMutation,
  useRenameAiChatMutation,
  fetchChatMessagesQueryFn,
} from "./use-ai-chats";
import { aiChatQueryKeys, getQueryClient } from "@/lib/react-query";
import { useAuthStore } from "@/features/auth";
import { aiApiUrl } from "@/lib/ai-service-url";

export type { ChatSession };

type ActiveChatContextValue = {
  chatId: string;
  chatTitle: string;
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => void;
  sendMessage: (message: { parts: { text: string; type: "text" }[]; role: "user" }) => void;
  status: "submitted" | "streaming" | "ready" | "error";
  stop: () => void;
  regenerate: (options?: { messageId?: string } & Record<string, unknown>) => Promise<void>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  chatList: ChatSession[];
  loadChat: (chat: ChatSession) => Promise<void>;
  startNewChat: () => void;
  deleteChat: (chatId: string) => Promise<void>;
  renameChat: (newTitle: string) => Promise<void>;
  isBackendReady: boolean | null;
  refreshChats: () => Promise<void>;
  isHistoryLoading: boolean;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ActiveChatProvider({
  children,
  initialChatId,
}: {
  children: ReactNode;
  initialChatId?: string;
}) {
  const router = useRouter();
  const params = useParams<{ chatId?: string }>();
  const searchParams = useSearchParams();

  const resolvedChatId =
    initialChatId || params?.chatId || searchParams?.get("chatId") || null;
  const isExistingChat = !!resolvedChatId;

  const [chatId, setChatId] = useState<string>(() => resolvedChatId || generateUUID());
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(() => isExistingChat);
  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const [input, setInput] = useState("");
  const [isBackendReady, setIsBackendReady] = useState<boolean | null>(null);

  // TanStack React Query for Chat List
  const { data: serverChats, refetch: refetchChatSessions } = useAiChatSessions();
  const deleteMutation = useDeleteAiChatMutation();

  const chatList = useMemo(() => serverChats || [], [serverChats]);

  // Check backend health
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(aiApiUrl("/health"));
      setIsBackendReady(res.ok);
    } catch {
      setIsBackendReady(false);
    }
  }, []);

  const refreshChats = useCallback(async () => {
    await refetchChatSessions();
  }, [refetchChatSessions]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const authUser = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUserId = authUser?.id || "guest";

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: aiApiUrl("/chat"),
        headers: {
          "X-User-Id": currentUserId,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        prepareSendMessagesRequest(request) {
          const lastMessage = request.messages.at(-1);
          return {
            body: {
              id: request.id,
              chatId: request.id,
              message: lastMessage,
              selectedChatModel: currentModelId,
              selectedModel: currentModelId,
            },
          };
        },
      }),
    [accessToken, currentModelId, currentUserId]
  );

  // Vercel AI useChat integration
  const {
    messages,
    setMessages,
    sendMessage: rawSendMessage,
    status,
    stop,
    regenerate,
  } = useChat<ChatMessage>({
    id: chatId,
    generateId: generateUUID,
    onError: (error) => {
      const msg = error.message || "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Quota exceeded")) {
        toast.error("Hệ thống AI đạt giới hạn lượt yêu cầu miễn phí (Free Tier). Vui lòng đợi khoảng 30-60 giây rồi thử lại!");
      } else if (msg.includes("503") || msg.includes("high demand") || msg.includes("UNAVAILABLE")) {
        toast.error("Mô hình AI hiện đang quá tải từ máy chủ Google. Vui lòng thử lại sau giây lát!");
      } else {
        toast.error("Đã xảy ra lỗi khi kết nối với AI Service. Vui lòng thử lại!");
      }
    },
    transport,
    onFinish: () => {
      const qc = getQueryClient();
      void qc.invalidateQueries({ queryKey: aiChatQueryKeys.all });
    },
  });

  // Fetch messages when loading an existing chat
  useEffect(() => {
    let isMounted = true;
    if (resolvedChatId) {
      setIsHistoryLoading(true);
      const queryClient = getQueryClient();
      queryClient
        .fetchQuery({
          queryKey: aiChatQueryKeys.detail(resolvedChatId),
          queryFn: () => fetchChatMessagesQueryFn(resolvedChatId),
          staleTime: 5 * 60 * 1000,
        })
        .then((loaded) => {
          if (isMounted) {
            setMessages(loaded);
            setIsHistoryLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load chat history:", err);
          if (isMounted) {
            setIsHistoryLoading(false);
            toast.error("Không thể tải lịch sử cuộc trò chuyện.");
          }
        });
    } else {
      setIsHistoryLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [resolvedChatId, setMessages]);

  const sendMessage = useCallback(
    (msg: { parts: { text: string; type: "text" }[]; role: "user" }) => {
      // If on new chat (/ai-planner) without chatId in URL, update URL bar immediately
      if (!resolvedChatId && typeof window !== "undefined") {
        window.history.replaceState(null, "", `/ai-planner/${chatId}`);
      }
      rawSendMessage(msg as unknown as Parameters<typeof rawSendMessage>[0]);
    },
    [chatId, rawSendMessage, resolvedChatId]
  );

  // Start new chat
  const startNewChat = useCallback(() => {
    stop();
    setChatId(generateUUID());
    setMessages([]);
    setInput("");
    router.push("/ai-planner");
  }, [router, setMessages, stop]);

  // Load a chat from history
  const loadChat = useCallback(
    async (chat: ChatSession) => {
      stop();
      router.push(`/ai-planner/${chat.id}`);
    },
    [router, stop]
  );

  const renameMutation = useRenameAiChatMutation();

  const currentChat = useMemo(
    () => chatList.find((c) => c.id === chatId),
    [chatList, chatId]
  );
  const chatTitle =
    currentChat?.title ||
    (messages.length > 0 ? "Kế hoạch chuyến đi của bạn" : "New chat");

  // Rename chat
  const renameChat = useCallback(
    async (newTitle: string) => {
      if (!newTitle.trim()) return;
      try {
        await renameMutation.mutateAsync({ chatId, title: newTitle.trim() });
        toast.success("Đã đổi tên cuộc trò chuyện thành công!");
      } catch (err: any) {
        toast.error(err.message || "Không thể đổi tên cuộc trò chuyện.");
      }
    },
    [chatId, renameMutation]
  );

  // Delete chat
  const deleteChat = useCallback(
    async (targetChatId: string) => {
      try {
        await deleteMutation.mutateAsync(targetChatId);
        if (chatId === targetChatId) {
          startNewChat();
        }
        toast.success("Đã xoá cuộc trò chuyện.");
      } catch {
        toast.error("Không thể xoá cuộc trò chuyện.");
      }
    },
    [chatId, deleteMutation, startNewChat]
  );

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      chatId,
      chatTitle,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      input,
      setInput,
      currentModelId,
      setCurrentModelId,
      chatList,
      loadChat,
      startNewChat,
      deleteChat,
      renameChat,
      isBackendReady,
      refreshChats,
      isHistoryLoading,
    }),
    [
      chatId,
      chatTitle,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      input,
      currentModelId,
      chatList,
      loadChat,
      startNewChat,
      deleteChat,
      renameChat,
      isBackendReady,
      refreshChats,
      isHistoryLoading,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
