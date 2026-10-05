import {
  ChatUser,
  Conversation,
  ChatMessageItem,
} from "../types/chat.types";

export const CURRENT_USER_ID = "current-user";

export const INITIAL_AVAILABLE_USERS: ChatUser[] = [
  {
    id: "user-linh",
    name: "Khánh Linh",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "user-kiet",
    name: "Tuấn Kiệt",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    isOnline: false,
    statusText: "Hoạt động 2 giờ trước",
  },
  {
    id: "user-phuong",
    name: "Mai Phương",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "user-tung",
    name: "Thanh Tùng",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    isOnline: false,
    statusText: "Hoạt động hôm qua",
  },
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    user: {
      id: "u-minhanh",
      name: "Minh Anh",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      isOnline: true,
      statusText: "Đang hoạt động",
    },
    lastMessage: "Mình lưu lại hết rồi. Cảm ơn bạn rất nhiều, có dịp ghé Hà Nội ới mình mời cà phê nhé!",
    lastMessageTime: "10:20",
    lastMessageTimestamp: Date.now() - 1000 * 60 * 15,
    unreadCount: 0,
    isRequest: false,
    isMuted: false,
    messages: [
      {
        id: "msg-1-1",
        senderId: "u-minhanh",
        text: "Chào bạn! Mình có xem bài viết chia sẻ về chuyến đi Hội An của bạn trên cộng đồng, hình ảnh và gợi ý lịch trình đẹp quá.",
        createdAt: "2026-09-22T09:30:00Z",
        status: "read",
      },
      {
        id: "msg-1-2",
        senderId: CURRENT_USER_ID,
        text: "Cảm ơn Minh Anh nhiều nha! Đợt đó mình đi trúng mùa đèn lồng rằm tháng Giêng nên phố cổ lung linh lắm.",
        createdAt: "2026-09-22T09:35:00Z",
        status: "read",
      },
      {
        id: "msg-1-3",
        senderId: "u-minhanh",
        text: "Thích thật đấy! Cuối tuần sau mình và nhóm bạn định vào Đà Nẵng - Hội An khoảng 4 ngày 3 đêm. Bạn còn lưu lịch trình chi tiết các điểm tham quan không, cho mình xin tham khảo với nhé?",
        createdAt: "2026-09-23T14:10:00Z",
        status: "read",
      },
      {
        id: "msg-1-4",
        senderId: CURRENT_USER_ID,
        text: "Có chứ bạn ơi, mình vừa hoàn thành xong bản kế hoạch chi tiết các chặng di chuyển, khách sạn và điểm check-in nè, gửi bạn xem qua nhé!",
        createdAt: "2026-09-23T14:15:00Z",
        status: "read",
        sharedTrip: {
          id: "trip-danang-hoian",
          title: "Khám phá di sản Đà Nẵng - Phố cổ Hội An",
          location: "Đà Nẵng & Hội An, Quảng Nam",
          durationDays: 4,
          durationNights: 3,
          coverImage: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80",
        },
      },
      {
        id: "msg-1-5",
        senderId: "u-minhanh",
        text: "Oa, lịch trình sắp xếp hợp lý quá, có cả thời gian nghỉ ngơi thư giãn ở biển An Bàng nữa!",
        createdAt: "2026-09-23T14:30:00Z",
        status: "read",
      },
      {
        id: "msg-1-6",
        senderId: "u-minhanh",
        text: "Cho mình hỏi thêm xíu là buổi tối đi thuyền thả hoa đăng trên sông Hoài thì nên đi lúc mấy giờ để đỡ đông khách du lịch bạn nhỉ?",
        createdAt: "2026-09-23T14:31:00Z",
        status: "read",
      },
      {
        id: "msg-1-7",
        senderId: CURRENT_USER_ID,
        text: "Tầm 18:00 đến 18:45 là đẹp nhất bạn nhé, lúc trời vừa chập choạng tối, đèn lồng bắt đầu thắp sáng mà bờ sông chưa quá đông đúc.",
        createdAt: "2026-09-23T15:00:00Z",
        status: "read",
      },
      {
        id: "msg-1-8",
        senderId: "u-minhanh",
        text: "Tuyệt vời, cảm ơn kinh nghiệm quý báu của bạn nha! À bạn có quán ăn địa phương nào ở Hội An nhất định phải thử không?",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        status: "read",
      },
      {
        id: "msg-1-9",
        senderId: CURRENT_USER_ID,
        text: "Bạn nhất định phải thử Cơm gà Bà Buội ở Phan Chu Trinh và Cao lầu Thanh ở Thái Phiên nhé. Buổi chiều ghé tiệm Mót uống ly nước thảo mộc thanh mát cực kỳ!",
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        status: "read",
      },
      {
        id: "msg-1-10",
        senderId: "u-minhanh",
        text: "Mình lưu lại hết rồi. Cảm ơn bạn rất nhiều, có dịp ghé Hà Nội ới mình mời cà phê nhé! Chúc bạn tuần mới vui vẻ.",
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        status: "read",
      },
    ],
  },
  {
    id: "conv-2",
    user: {
      id: "u-baonam",
      name: "Bảo Nam",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      isOnline: false,
      statusText: "Hoạt động 15 phút trước",
    },
    lastMessage: "Cậu có danh sách các quán hải sản ngon ở làng chài Hàm Ninh không?",
    lastMessageTime: "09:20",
    lastMessageTimestamp: Date.now() - 1000 * 60 * 60,
    unreadCount: 0,
    isRequest: false,
    isMuted: false,
    messages: [
      {
        id: "msg-2-1",
        senderId: "u-baonam",
        text: "Chào cậu, cuối tuần này nhóm tớ ra Phú Quốc lặn ngắm san hô và khám phá đảo ngọc đây.",
        createdAt: "2026-09-23T16:00:00Z",
        status: "read",
      },
      {
        id: "msg-2-2",
        senderId: CURRENT_USER_ID,
        text: "Thích thế Nam ơi, nhớ ghé Bãi Sao và ngắm hoàng hôn Sunset Sanato nhé! Lặn ngắm san hô ở hòn Móng Tay cũng rất tuyệt.",
        createdAt: "2026-09-23T16:25:00Z",
        status: "read",
      },
      {
        id: "msg-2-3",
        senderId: CURRENT_USER_ID,
        text: "Cậu có danh sách các quán hải sản ngon ở làng chài Hàm Ninh không?",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        status: "failed", // Demo failed message for Requirement 8
        retryPayload: "Cậu có danh sách các quán hải sản ngon ở làng chài Hàm Ninh không?",
      },
    ],
  },
  {
    id: "conv-3",
    user: {
      id: "u-thutrang",
      name: "Thu Trang",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
      isOnline: true,
      statusText: "Đang hoạt động",
    },
    lastMessage: "Bạn ơi cho mình hỏi đi thuyền rồng ngắm hoàng hôn trên sông Hương vào buổi tối có cần đặt vé trước không?",
    lastMessageTime: "Hôm qua",
    lastMessageTimestamp: Date.now() - 1000 * 60 * 60 * 24,
    unreadCount: 2,
    isRequest: false,
    isMuted: false,
    messages: [
      {
        id: "msg-3-1",
        senderId: "u-thutrang",
        text: "Chào bạn, mình thấy bạn vừa đi cố đô Huế về, bộ ảnh Đại Nội đẹp xuất sắc luôn!",
        createdAt: "2026-09-23T11:00:00Z",
        status: "read",
      },
      {
        id: "msg-3-2",
        senderId: "u-thutrang",
        text: "Bạn ơi cho mình hỏi đi thuyền rồng ngắm hoàng hôn trên sông Hương vào buổi tối có cần đặt vé trước không?",
        createdAt: "2026-09-23T11:02:00Z",
        status: "sent",
      },
    ],
  },
  {
    id: "conv-4",
    user: {
      id: "u-hoanglong",
      name: "Hoàng Long",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      isOnline: false,
      statusText: "Hoạt động 3 giờ trước",
    },
    lastMessage: "Chào bạn, mình thấy bài viết bạn chia sẻ về hành trình phượt Hà Giang mùa hoa tam giác mạch...",
    lastMessageTime: "Hôm qua",
    lastMessageTimestamp: Date.now() - 1000 * 60 * 60 * 30,
    unreadCount: 1,
    isRequest: true, // Demo Message Request for Requirement 11
    isMuted: false,
    messages: [
      {
        id: "msg-4-1",
        senderId: "u-hoanglong",
        text: "Chào bạn, mình thấy bài viết bạn chia sẻ về hành trình phượt Hà Giang mùa hoa tam giác mạch. Cho mình xin kinh nghiệm thuê xe máy và homestay ở Đồng Văn với nhé!",
        createdAt: "2026-09-23T08:15:00Z",
        status: "sent",
      },
    ],
  },
];

class MockChatService {
  private conversations: Conversation[] = [];
  private availableUsers: ChatUser[] = [];
  private simulateFailure = false;
  private isOffline = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.reset();
  }

  public reset() {
    // Deep clone initial data
    this.conversations = JSON.parse(JSON.stringify(INITIAL_CONVERSATIONS));
    this.availableUsers = JSON.parse(JSON.stringify(INITIAL_AVAILABLE_USERS));
    this.simulateFailure = false;
    this.isOffline = false;
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public getConversations(): Conversation[] {
    return [...this.conversations];
  }

  public getConversationById(id: string): Conversation | undefined {
    return this.conversations.find((c) => c.id === id);
  }

  public getAvailableUsers(): ChatUser[] {
    return [...this.availableUsers];
  }

  public searchUsersByDisplayName(query: string): ChatUser[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return this.availableUsers;
    return this.availableUsers.filter((u) =>
      u.name.toLowerCase().includes(trimmed)
    );
  }

  public getTotalUnreadCount(): number {
    return this.conversations
      .filter((c) => !c.isRequest)
      .reduce((sum, c) => sum + c.unreadCount, 0);
  }

  public getRequestCount(): number {
    return this.conversations.filter((c) => c.isRequest).length;
  }

  public markAsRead(convId: string) {
    const conv = this.conversations.find((c) => c.id === convId);
    if (!conv) return;

    if (conv.unreadCount > 0) {
      conv.unreadCount = 0;
      conv.messages.forEach((m) => {
        if (m.senderId !== CURRENT_USER_ID && m.status !== "read") {
          m.status = "read";
        }
      });
      this.notify();
    }
  }

  public async sendMessage(
    convId: string,
    text: string
  ): Promise<{ success: boolean; message: ChatMessageItem }> {
    const conv = this.conversations.find((c) => c.id === convId);
    if (!conv) {
      throw new Error("Conversation not found");
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const willFail = this.simulateFailure || this.isOffline;

    const newMessage: ChatMessageItem = {
      id: messageId,
      senderId: CURRENT_USER_ID,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      status: "sending",
      retryPayload: text.trim(),
    };

    // Optimistic append
    conv.messages.push(newMessage);
    conv.lastMessage = newMessage.text;
    conv.lastMessageTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    conv.lastMessageTimestamp = Date.now();

    // Move to top of list
    this.conversations = [
      conv,
      ...this.conversations.filter((c) => c.id !== convId),
    ];

    this.notify();

    // Simulated network delay (400ms)
    await new Promise((resolve) => setTimeout(resolve, 400));

    const targetMsg = conv.messages.find((m) => m.id === messageId);
    if (targetMsg) {
      if (willFail) {
        targetMsg.status = "failed";
        this.notify();
        return { success: false, message: targetMsg };
      } else {
        targetMsg.status = "sent";
        this.notify();
        return { success: true, message: targetMsg };
      }
    }

    return { success: !willFail, message: newMessage };
  }

  public async retryMessage(
    convId: string,
    messageId: string
  ): Promise<{ success: boolean }> {
    const conv = this.conversations.find((c) => c.id === convId);
    if (!conv) return { success: false };

    const msg = conv.messages.find((m) => m.id === messageId);
    if (!msg) return { success: false };

    msg.status = "sending";
    this.notify();

    await new Promise((resolve) => setTimeout(resolve, 400));

    if (this.isOffline) {
      msg.status = "failed";
      this.notify();
      return { success: false };
    }

    msg.status = "sent";
    this.notify();
    return { success: true };
  }

  public startNewConversation(targetUser: ChatUser): Conversation {
    // Check if conversation already exists
    const existing = this.conversations.find((c) => c.user.id === targetUser.id);
    if (existing) {
      return existing;
    }

    // Per Requirement 14: NO fake bot welcome messages sent by recipient!
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      user: targetUser,
      lastMessage: "",
      lastMessageTime: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      lastMessageTimestamp: Date.now(),
      unreadCount: 0,
      isRequest: false,
      isMuted: false,
      messages: [],
    };

    this.conversations.unshift(newConv);
    this.notify();
    return newConv;
  }

  public acceptRequest(convId: string) {
    const conv = this.conversations.find((c) => c.id === convId);
    if (!conv) return;

    conv.isRequest = false;
    conv.unreadCount = 0;
    this.notify();
  }

  public declineRequest(convId: string) {
    this.conversations = this.conversations.filter((c) => c.id !== convId);
    this.notify();
  }

  public blockUser(convId: string) {
    const conv = this.conversations.find((c) => c.id === convId);
    if (conv) {
      // Remove from available users and conversation list
      this.availableUsers = this.availableUsers.filter(
        (u) => u.id !== conv.user.id
      );
      this.conversations = this.conversations.filter((c) => c.id !== convId);
      this.notify();
    }
  }

  public toggleMute(convId: string): boolean {
    const conv = this.conversations.find((c) => c.id === convId);
    if (!conv) return false;

    conv.isMuted = !conv.isMuted;
    this.notify();
    return !!conv.isMuted;
  }

  public setSimulateFailure(value: boolean) {
    this.simulateFailure = value;
    this.notify();
  }

  public getSimulateFailure(): boolean {
    return this.simulateFailure;
  }

  public setIsOffline(value: boolean) {
    this.isOffline = value;
    this.notify();
  }

  public getIsOffline(): boolean {
    return this.isOffline;
  }
}

export const mockChatService = new MockChatService();
