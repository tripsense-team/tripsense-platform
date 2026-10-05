import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { NewChatDialog } from "../components/new-chat-dialog";
import { ShareTripDialog } from "../components/share-trip-dialog";
import { BlockedUsersDialog } from "../components/blocked-users-dialog";

// Mock i18n
vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        let res = key;
        Object.entries(params).forEach(([k, v]) => {
          res += `:${k}=${v}`;
        });
        return res;
      }
      return key;
    },
  }),
}));

// Mock Dialog primitives to render inline instead of through Radix DOM portal
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={className}>{children}</p>
  ),
}));

describe("Chat Dialogs Rendering", () => {
  it("renders NewChatDialog with header, search input, and initial search prompt", () => {
    const html = renderToString(
      <NewChatDialog open={true} onOpenChange={() => {}} onSelectUser={() => {}} />
    );

    expect(html).toContain("chat.dialogs.newChat.title");
    expect(html).toContain("chat.dialogs.newChat.description");
    expect(html).toContain("chat.dialogs.newChat.placeholder");
    expect(html).toContain("chat.dialogs.newChat.minimumQuery");
    expect(html).not.toContain("Khánh Linh");
    expect(html).not.toContain("Tuấn Kiệt");
  });

  it("renders ShareTripDialog with title and description", () => {
    const html = renderToString(
      <ShareTripDialog
        open={true}
        onOpenChange={() => {}}
        userId="user-123"
        onSelect={() => {}}
      />
    );

    expect(html).toContain("chat.sharedTrip.shareAction");
    expect(html).toContain("chat.sharedTrip.choosePublic");
  });

  it("renders BlockedUsersDialog with title and description", () => {
    const html = renderToString(
      <BlockedUsersDialog
        open={true}
        onOpenChange={() => {}}
        onChanged={() => {}}
      />
    );

    expect(html).toContain("chat.blocks.title");
    expect(html).toContain("chat.blocks.description");
  });
});
