import { describe, expect, it } from "vitest";
import { shouldSubmitChatOnEnter } from "../components/chat-input";

describe("ChatInput IME submission guard", () => {
  it("does not submit Enter while Vietnamese IME is composing", () => {
    expect(shouldSubmitChatOnEnter({
      key: "Enter",
      shiftKey: false,
      isComposing: true,
    })).toBe(false);
  });

  it("does not submit Safari's IME keyCode 229 event", () => {
    expect(shouldSubmitChatOnEnter({
      key: "Enter",
      shiftKey: false,
      isComposing: false,
      keyCode: 229,
    })).toBe(false);
  });

  it("submits a regular Enter but preserves Shift+Enter", () => {
    expect(shouldSubmitChatOnEnter({
      key: "Enter",
      shiftKey: false,
      isComposing: false,
      keyCode: 13,
    })).toBe(true);
    expect(shouldSubmitChatOnEnter({
      key: "Enter",
      shiftKey: true,
      isComposing: false,
      keyCode: 13,
    })).toBe(false);
  });
});
