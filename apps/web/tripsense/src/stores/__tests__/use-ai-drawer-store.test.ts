import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useAiDrawerStore } from "../use-ai-drawer-store";

describe("useAiDrawerStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAiDrawerStore.setState({
      isOpen: false,
      isHovered: false,
      searchQuery: "",
      selectedChatId: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with closed drawer by default", () => {
    const state = useAiDrawerStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.isHovered).toBe(false);
    expect(state.searchQuery).toBe("");
    expect(state.selectedChatId).toBeNull();
  });

  it("toggles drawer state correctly", () => {
    useAiDrawerStore.getState().toggleDrawer();
    expect(useAiDrawerStore.getState().isOpen).toBe(true);

    useAiDrawerStore.getState().toggleDrawer();
    expect(useAiDrawerStore.getState().isOpen).toBe(false);
  });

  it("openDrawer immediately opens drawer and sets isHovered", () => {
    useAiDrawerStore.getState().openDrawer();
    expect(useAiDrawerStore.getState().isOpen).toBe(true);
    expect(useAiDrawerStore.getState().isHovered).toBe(true);
  });

  it("closeDrawerWithDelay closes drawer after grace period", () => {
    useAiDrawerStore.getState().openDrawer();
    expect(useAiDrawerStore.getState().isOpen).toBe(true);

    useAiDrawerStore.getState().closeDrawerWithDelay(200);
    // Still open before timer expires
    expect(useAiDrawerStore.getState().isOpen).toBe(true);

    // Fast-forward 200ms
    vi.advanceTimersByTime(200);
    expect(useAiDrawerStore.getState().isOpen).toBe(false);
    expect(useAiDrawerStore.getState().isHovered).toBe(false);
  });

  it("cancelCloseDelay prevents drawer from closing when mouse re-enters", () => {
    useAiDrawerStore.getState().openDrawer();
    useAiDrawerStore.getState().closeDrawerWithDelay(200);

    // Mouse enters before 200ms
    vi.advanceTimersByTime(100);
    useAiDrawerStore.getState().cancelCloseDelay();

    // Fast-forward past the original 200ms mark
    vi.advanceTimersByTime(150);
    expect(useAiDrawerStore.getState().isOpen).toBe(true);
    expect(useAiDrawerStore.getState().isHovered).toBe(true);
  });

  it("updates search query and selected chat id", () => {
    useAiDrawerStore.getState().setSearchQuery("Đà Nẵng");
    expect(useAiDrawerStore.getState().searchQuery).toBe("Đà Nẵng");

    useAiDrawerStore.getState().setSelectedChatId("chat-123");
    expect(useAiDrawerStore.getState().selectedChatId).toBe("chat-123");
  });
});
