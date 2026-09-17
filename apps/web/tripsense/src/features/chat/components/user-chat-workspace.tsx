"use client";

import * as React from "react";
import {
  Search,
  Plus,
  Send,
  User,
  CheckCheck,
  MapPin,
  Compass,
  ArrowLeft,
  MoreVertical,
  Share2,
  Sparkles,
  MessageSquare,
  Circle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  statusText?: string;
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isRead?: boolean;
  sharedTrip?: {
    title: string;
    location: string;
  };
}

export interface Conversation {
  id: string;
  user: ChatUser;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: ChatMessageItem[];
}

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    user: {
      id: "u-1",
      name: "Minh Anh",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      isOnline: true,
      statusText: "Đang hoạt động",
    },
    lastMessage: "Hành trình Đà Nẵng 3 ngày thế nào rồi bạn?",
    lastMessageTime: "10:42 AM",
    unreadCount: 2,
    messages: [
      {
        id: "m-1",
        senderId: "u-1",
        text: "Chào bạn, tớ thấy bài viết chuyến đi Đà Nẵng của bạn đẹp quá!",
        timestamp: "10:38 AM",
      },
      {
        id: "m-2",
        senderId: "current-user",
        text: "Cảm ơn Minh Anh nhé! Tớ vừa lên xong lịch trình chi tiết đó.",
        timestamp: "10:40 AM",
        isRead: true,
      },
      {
        id: "m-3",
        senderId: "u-1",
        text: "Hành trình Đà Nẵng 3 ngày thế nào rồi bạn? Cho tớ tham khảo với nha!",
        timestamp: "10:42 AM",
      },
    ],
  },
  {
    id: "conv-2",
    user: {
      id: "u-2",
      name: "Bảo Nam",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      isOnline: false,
      statusText: "Hoạt động 15 phút trước",
    },
    lastMessage: "Cậu xem giúp tớ lịch trình Phú Quốc nhé!",
    lastMessageTime: "Hôm qua",
    unreadCount: 0,
    messages: [
      {
        id: "m-4",
        senderId: "u-2",
        text: "Chào Nam, cậu rảnh không?",
        timestamp: "Hôm qua 15:20",
      },
      {
        id: "m-5",
        senderId: "u-2",
        text: "Cậu xem giúp tớ lịch trình Phú Quốc nhé!",
        timestamp: "Hôm qua 15:21",
        sharedTrip: {
          title: "Khám phá ngọc đảo Phú Quốc 4N3Đ",
          location: "Phú Quốc, Kiên Giang",
        },
      },
      {
        id: "m-6",
        senderId: "current-user",
        text: "Ok Nam, tớ xem qua rồi góp ý cho cậu liền!",
        timestamp: "Hôm qua 16:05",
        isRead: true,
      },
    ],
  },
  {
    id: "conv-3",
    user: {
      id: "u-3",
      name: "Thu Trang",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
      isOnline: true,
      statusText: "Đang hoạt động",
    },
    lastMessage: "Cảm ơn bạn đã chia sẻ địa điểm ăn uống ở Huế!",
    lastMessageTime: "Thứ 2",
    unreadCount: 0,
    messages: [
      {
        id: "m-7",
        senderId: "current-user",
        text: "Chào Trang, tớ gửi bạn danh sách quán ăn Huế nè.",
        timestamp: "Thứ 2 09:15",
        isRead: true,
      },
      {
        id: "m-8",
        senderId: "u-3",
        text: "Cảm ơn bạn đã chia sẻ địa điểm ăn uống ở Huế!",
        timestamp: "Thứ 2 09:30",
      },
    ],
  },
];

const AVAILABLE_USERS: ChatUser[] = [
  {
    id: "u-4",
    name: "Hoàng Long",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "u-5",
    name: "Khánh Linh",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    isOnline: false,
    statusText: "Hoạt động 1 giờ trước",
  },
];

export function UserChatWorkspace() {
  const [conversations, setConversations] = React.useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = React.useState<string>("conv-1");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [messageInput, setMessageInput] = React.useState("");
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const [mobileView, setMobileView] = React.useState<"list" | "thread">("list");

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId) || conversations[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  const filteredConversations = conversations.filter((c) =>
    c.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || messageInput.trim();
    if (!text || !activeConversation) return;

    const newMessage: ChatMessageItem = {
      id: `msg-${Date.now()}`,
      senderId: "current-user",
      text: text,
      timestamp: "Mới xong",
      isRead: false,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConversation.id) {
          return {
            ...c,
            lastMessage: text,
            lastMessageTime: "Mới xong",
            messages: [...c.messages, newMessage],
          };
        }
        return c;
      })
    );

    setMessageInput("");
  };

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    setMobileView("thread");
    // Clear unread count
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const handleStartNewChat = (targetUser: ChatUser) => {
    const existing = conversations.find((c) => c.user.id === targetUser.id);
    if (existing) {
      handleSelectConversation(existing.id);
    } else {
      const newConv: Conversation = {
        id: `conv-${Date.now()}`,
        user: targetUser,
        lastMessage: "Bắt đầu cuộc trò chuyện",
        lastMessageTime: "Vừa xong",
        unreadCount: 0,
        messages: [
          {
            id: `msg-welcome-${Date.now()}`,
            senderId: targetUser.id,
            text: `Chào bạn! Hãy cùng chia sẻ kinh nghiệm du lịch nhé.`,
            timestamp: "Vừa xong",
          },
        ],
      };
      setConversations([newConv, ...conversations]);
      setActiveConvId(newConv.id);
      setMobileView("thread");
    }
    setIsNewChatOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Left Sidebar: Conversation List */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-card shrink-0 transition-all",
          mobileView === "thread" ? "hidden md:flex" : "flex"
        )}
      >
        {/* Header & Action */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Tin nhắn</h2>
              <p className="text-xs text-muted-foreground">Trò chuyện với bạn bè du lịch</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsNewChatOpen(true)}
            className="rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Chat mới</span>
          </Button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tin nhắn hoặc người dùng..."
              className="pl-9 bg-muted/40 rounded-xl text-xs"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              Không tìm thấy cuộc trò chuyện nào.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "w-full p-3.5 flex items-center gap-3 text-left transition-all hover:bg-muted/50 relative group",
                    isActive && "bg-muted/80 font-medium"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11 border border-border">
                      <AvatarImage src={conv.user.avatar} alt={conv.user.name} />
                      <AvatarFallback>{conv.user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {conv.user.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {conv.user.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                        {conv.lastMessageTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge className="h-5 px-1.5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center shrink-0">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Main Thread */}
      <div
        className={cn(
          "flex-1 flex flex-col bg-background/50 backdrop-blur-xs",
          mobileView === "list" ? "hidden md:flex" : "flex"
        )}
      >
        {activeConversation ? (
          <>
            {/* Thread Header */}
            <div className="p-3.5 px-4 border-b border-border bg-card/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileView("list")}
                  className="md:hidden h-8 w-8 text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="relative">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={activeConversation.user.avatar} alt={activeConversation.user.name} />
                    <AvatarFallback>{activeConversation.user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {activeConversation.user.isOnline && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    {activeConversation.user.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Circle className={cn("h-2 w-2 fill-current", activeConversation.user.isOnline ? "text-emerald-500" : "text-muted-foreground")} />
                    {activeConversation.user.statusText}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex gap-1"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Trang cá nhân</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeConversation.messages.map((msg) => {
                const isMe = msg.senderId === "current-user";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex items-end gap-2 max-w-[80%]", isMe ? "ml-auto flex-row-reverse" : "mr-auto")}
                  >
                    {!isMe && (
                      <Avatar className="h-7 w-7 shrink-0 mb-1 border border-border">
                        <AvatarImage src={activeConversation.user.avatar} />
                        <AvatarFallback>{activeConversation.user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}

                    <div className="space-y-1">
                      {/* Shared Trip Preview Card if present */}
                      {msg.sharedTrip && (
                        <div className="rounded-xl border border-border bg-card p-3 shadow-xs mb-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                            <Compass className="h-3.5 w-3.5" />
                            <span>Chuyến đi được chia sẻ</span>
                          </div>
                          <h4 className="font-bold text-sm text-foreground">{msg.sharedTrip.title}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {msg.sharedTrip.location}
                          </p>
                        </div>
                      )}

                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm shadow-2xs leading-relaxed",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-xs"
                            : "bg-card border border-border text-card-foreground rounded-bl-xs"
                        )}
                      >
                        {msg.text}
                      </div>

                      <div className={cn("flex items-center gap-1 text-[10px] text-muted-foreground px-1", isMe ? "justify-end" : "justify-start")}>
                        <span>{msg.timestamp}</span>
                        {isMe && <CheckCheck className={cn("h-3 w-3", msg.isRead ? "text-primary" : "text-muted-foreground")} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Suggestion Chips */}
            <div className="px-4 py-2 bg-card/40 border-t border-border/40 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1 font-medium">
                <Sparkles className="h-3 w-3 text-primary" /> Suggestion:
              </span>
              <button
                onClick={() => handleSendMessage("Bạn có muốn đi du lịch cùng tớ không?")}
                className="px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-foreground text-xs shrink-0 transition-colors"
              >
                Gợi ý đi du lịch cùng nhau
              </button>
              <button
                onClick={() => handleSendMessage("Chia sẻ giúp tớ thêm địa điểm đẹp nhé!")}
                className="px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-foreground text-xs shrink-0 transition-colors"
              >
                Hỏi gợi ý địa điểm
              </button>
            </div>

            {/* Input Bar */}
            <div className="p-3.5 border-t border-border bg-card">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={`Nhắn tin cho ${activeConversation.user.name}...`}
                  className="flex-1 bg-muted/40 rounded-full px-4 text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!messageInput.trim()}
                  className="rounded-full h-10 w-10 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs shrink-0 transition-all"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-bold text-base text-foreground mb-1">Chọn cuộc trò chuyện</h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Chọn một người dùng từ danh sách bên trái hoặc bắt đầu cuộc trò chuyện mới để trao đổi về hành trình du lịch.
            </p>
            <Button onClick={() => setIsNewChatOpen(true)} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              <span>Tạo cuộc trò chuyện mới</span>
            </Button>
          </div>
        )}
      </div>

      {/* New Chat User Selection Dialog */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Tạo cuộc trò chuyện mới</DialogTitle>
            <DialogDescription>
              Tìm kiếm người dùng trên TripSense để gửi tin nhắn trực tiếp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Nhập tên người dùng..."
                className="pl-9 rounded-xl text-sm"
              />
            </div>

            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden max-h-60 overflow-y-auto">
              {AVAILABLE_USERS.filter((u) =>
                u.name.toLowerCase().includes(userSearchQuery.toLowerCase())
              ).map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleStartNewChat(user)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{user.name}</h4>
                      <p className="text-[11px] text-muted-foreground">{user.statusText}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-primary font-medium">
                    Nhắn tin
                  </Button>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
