"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiChatQueryKeys, getQueryClient } from "@/lib/react-query";
import type { ChatMessage } from "@/lib/types";
import { authenticatedFetch } from "@/services/api-client";
import { aiApiUrl } from "@/lib/ai-service-url";

export type ChatSession = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Fetch list of all chat sessions for current user.
 */
export async function fetchAiChatsQueryFn(): Promise<ChatSession[]> {
  try {
    const res = await authenticatedFetch(aiApiUrl("/chats"));
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return (data.chats as ChatSession[]) || [];
  } catch {
    return [];
  }
}

/**
 * Proactively prefetch AI chat sessions into TanStack React Query cache.
 * Enables 0ms instantaneous opening of the Mindtrip Sidebar Drawer.
 */
export async function prefetchAiChats(): Promise<void> {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: aiChatQueryKeys.all,
    queryFn: fetchAiChatsQueryFn,
    staleTime: 60 * 1000,
  });
}

/**
 * Fetch messages for a specific chat session on click.
 * Strictly Click-to-Load (No hover prefetching per user requirement).
 */
export async function fetchChatMessagesQueryFn(
  chatId: string
): Promise<ChatMessage[]> {
  const res = await authenticatedFetch(aiApiUrl(`/chats/${chatId}/messages`));
  if (!res.ok) {
    throw new Error(`Failed to load chat messages for ${chatId}`);
  }
  const data = await res.json();
  const rawList = (data.messages as Array<{
    id: string;
    role: "user" | "assistant";
    parts: unknown;
  }>) || [];

  return rawList.map((m) => {
    let parsedParts = m.parts;
    if (typeof parsedParts === "string") {
      try {
        parsedParts = JSON.parse(parsedParts);
      } catch {
        parsedParts = [{ type: "text", text: parsedParts }];
      }
    }
    return {
      id: m.id,
      role: m.role,
      parts: Array.isArray(parsedParts) ? (parsedParts as any) : [{ type: "text", text: "" }],
    };
  });
}

/**
 * React hook to retrieve all chat sessions with React Query cache.
 */
export function useAiChatSessions() {
  return useQuery({
    queryKey: aiChatQueryKeys.all,
    queryFn: fetchAiChatsQueryFn,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * React hook to load messages for an active chat on-click with 5-minute caching.
 */
export function useAiChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: chatId ? aiChatQueryKeys.detail(chatId) : ["ai-v2", "empty"],
    queryFn: () => (chatId ? fetchChatMessagesQueryFn(chatId) : Promise.resolve([])),
    enabled: !!chatId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Hook to delete a chat session and invalidate cache.
 */
export function useDeleteAiChatMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatId: string) => {
      const res = await authenticatedFetch(aiApiUrl(`/chats/${chatId}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete chat");
      }
      return chatId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<ChatSession[]>(
        aiChatQueryKeys.all,
        (old) => (old ? old.filter((c) => c.id !== deletedId) : [])
      );
      void queryClient.invalidateQueries({ queryKey: aiChatQueryKeys.all });
    },
  });
}

/**
 * Hook to rename a chat session and invalidate cache.
 */
export function useRenameAiChatMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, title }: { chatId: string; title: string }) => {
      const res = await authenticatedFetch(aiApiUrl(`/chats/${chatId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        throw new Error("Failed to rename chat");
      }
      return { chatId, title };
    },
    onSuccess: ({ chatId, title }) => {
      queryClient.setQueryData<ChatSession[]>(
        aiChatQueryKeys.all,
        (old) =>
          old ? old.map((c) => (c.id === chatId ? { ...c, title } : c)) : []
      );
      void queryClient.invalidateQueries({ queryKey: aiChatQueryKeys.all });
    },
  });
}
