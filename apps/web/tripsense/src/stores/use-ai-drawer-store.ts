import { create } from "zustand";

export interface AiDrawerState {
  isOpen: boolean;
  isHovered: boolean;
  searchQuery: string;
  selectedChatId: string | null;

  // Actions
  setIsOpen: (isOpen: boolean) => void;
  toggleDrawer: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedChatId: (id: string | null) => void;
  openDrawer: () => void;
  closeDrawerWithDelay: (delayMs?: number) => void;
  cancelCloseDelay: () => void;
}

let closeTimer: NodeJS.Timeout | null = null;

export const openAiDrawer = () => {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  useAiDrawerStore.setState({ isHovered: true, isOpen: true });
};

export const closeAiDrawer = (delayMs = 250) => {
  if (closeTimer) {
    clearTimeout(closeTimer);
  }
  closeTimer = setTimeout(() => {
    useAiDrawerStore.setState({ isHovered: false, isOpen: false });
    closeTimer = null;
  }, delayMs);
};

export const toggleAiDrawer = () => {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  useAiDrawerStore.setState((state) => ({ isOpen: !state.isOpen }));
};

export const closeAiDrawerImmediate = () => {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  useAiDrawerStore.setState({ isHovered: false, isOpen: false });
};

export const cancelAiDrawerClose = () => {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  useAiDrawerStore.setState({ isHovered: true });
};

export const useAiDrawerStore = create<AiDrawerState>((set) => ({
  isOpen: false, // Default is closed on expanded sidebar (Image 2)
  isHovered: false,
  searchQuery: "",
  selectedChatId: null,

  setIsOpen: (isOpen) => set({ isOpen }),
  toggleDrawer: () => set((state) => ({ isOpen: !state.isOpen })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedChatId: (selectedChatId) => set({ selectedChatId }),

  openDrawer: openAiDrawer,
  closeDrawerWithDelay: closeAiDrawer,
  cancelCloseDelay: cancelAiDrawerClose,
}));
