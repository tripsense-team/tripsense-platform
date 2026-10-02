"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { ChatShell } from "@/components/chat/shell";

function LegacyChatRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyChatId = searchParams?.get("chatId");

  // Upgrade legacy /ai-planner?chatId=... to clean dynamic path /ai-planner/[chatId]
  React.useEffect(() => {
    if (legacyChatId) {
      router.replace(`/ai-planner/${legacyChatId}`);
    }
  }, [legacyChatId, router]);

  return null;
}

export default function AiPlannerPage() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <React.Suspense fallback={null}>
        <LegacyChatRedirect />
      </React.Suspense>
      <React.Suspense fallback={<div className="flex-1 bg-background" />}>
        <ActiveChatProvider>
          <ChatShell />
        </ActiveChatProvider>
      </React.Suspense>
    </div>
  );
}
