import * as React from "react";
import { UserChatWorkspace } from "@/features/chat";

export default function ChatPage() {
  return (
    <React.Suspense fallback={<div className="h-full w-full bg-muted/30" />}>
      <UserChatWorkspace />
    </React.Suspense>
  );
}

