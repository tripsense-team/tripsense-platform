"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { ChatShell } from "@/components/chat/shell";

export default function AiPlannerChatPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = params?.chatId;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <React.Suspense fallback={<div className="flex-1 bg-background" />}>
        <ActiveChatProvider key={chatId} initialChatId={chatId}>
          <ChatShell />
        </ActiveChatProvider>
      </React.Suspense>
    </div>
  );
}
