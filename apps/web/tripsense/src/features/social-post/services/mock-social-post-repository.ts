import { useAuthStore } from "@/features/auth/store/use-auth-store";
import type {
  CreateCommentRequest,
  CreateSocialPostRequest,
  ListPostsParams,
  PostComment,
  SocialPost,
  SocialPostPageResponse,
  ToggleLikeResponse,
  UploadSignatureResponse,
} from "../types";
import type { ISocialPostRepository } from "./social-post-repository";

const INITIAL_MOCK_POSTS: SocialPost[] = [
  {
    id: "post-1",
    author: {
      id: "user-1",
      name: "Lê Bảo",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      email: "lebao@tripsense.app",
    },
    content: "Hoàng hôn tuyệt đẹp nhìn từ đỉnh Bàn Cờ, Bán đảo Sơn Trà. Đà Nẵng mùa này thời tiết thật sự trong lành và gió mát rượi!",
    mediaUrls: [
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800&auto=format&fit=crop&q=80",
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    likeCount: 12,
    commentCount: 7,
    isLiked: false,
  },
  {
    id: "post-2",
    author: {
      id: "user-2",
      name: "Minh Trang",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      email: "trang.minh@tripsense.app",
    },
    content: "Một góc phố cổ Hội An bình yên vào buổi sớm mai. Những bức tường vàng rêu phong và giàn hoa giấy nở rực rỡ dưới nắng.",
    mediaUrls: [
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80",
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    likeCount: 24,
    commentCount: 2,
    isLiked: true,
  },
  {
    id: "post-3",
    author: {
      id: "user-3",
      name: "Hoàng Nam",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      email: "nam.hoang@tripsense.app",
    },
    content: "Chuyến trekking Tà Xùa săn mây lần thứ 3 trong năm. Cảm giác đứng trên sống lưng khủng long ngắm biển mây cuồn cuộn vẫn vẹn nguyên như ngày đầu.",
    mediaUrls: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80",
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    likeCount: 8,
    commentCount: 0,
    isLiked: false,
  },
];

const INITIAL_MOCK_COMMENTS: PostComment[] = [
  // Tree chain: comm-1 -> comm-2 -> comm-3 -> comm-4 -> comm-5
  {
    id: "comm-1",
    postId: "post-1",
    parentId: null,
    author: {
      id: "user-minhvi",
      name: "Minh Vi",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    },
    content: "Nạp chắc ko dưới 3 tỏi để có chuyến đi view xịn thế này!",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    likeCount: 5,
    isLiked: false,
  },
  {
    id: "comm-2",
    postId: "post-1",
    parentId: "comm-1",
    author: {
      id: "user-ngananh",
      name: "Ngân Anh",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    },
    content: "Nó phải 1 triệu đô mới chuẩn nha haha 🤣",
    createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    likeCount: 3,
    isLiked: true,
    replyToAuthorName: "Minh Vi",
  },
  {
    id: "comm-3",
    postId: "post-1",
    parentId: "comm-2",
    author: {
      id: "user-minhvi",
      name: "Minh Vi",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    },
    content: "Nói thật chứ đi mùa này nắng nhẹ gió mát, đứng ngắm hoàng hôn chill không muốn về.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    likeCount: 2,
    isLiked: false,
    replyToAuthorName: "Ngân Anh",
  },
  {
    id: "comm-4",
    postId: "post-1",
    parentId: "comm-3",
    author: {
      id: "user-kinben",
      name: "Kin Bền",
      avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    },
    content: "660 hai ông thế đó, hẹn hò ở Đỉnh Bàn Cờ mà không hú anh em gì hết trơn!",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    likeCount: 1,
    isLiked: false,
    replyToAuthorName: "Minh Vi",
  },
  {
    id: "comm-5",
    postId: "post-1",
    parentId: "comm-4",
    author: {
      id: "user-1",
      name: "Lê Bảo",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    content: "Cuối tuần sau làm kèo picnic trên Sơn Trà lại đê mọi người ơi! 🛵🌅",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    likeCount: 4,
    isLiked: true,
    replyToAuthorName: "Kin Bền",
  },
  // Another root branch on post-1
  {
    id: "comm-6",
    postId: "post-1",
    parentId: null,
    author: {
      id: "user-3",
      name: "Hoàng Nam",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    },
    content: "Góc chụp từ đỉnh Bàn Cờ đỉnh thật, nhìn rõ toàn cảnh vịnh luôn!",
    createdAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    likeCount: 4,
    isLiked: false,
  },
  {
    id: "comm-7",
    postId: "post-1",
    parentId: "comm-6",
    author: {
      id: "user-1",
      name: "Lê Bảo",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    content: "Cảm ơn Nam nhé, đợt này đi vào tầm 4h30 chiều là ánh sáng đẹp nhất.",
    createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    likeCount: 1,
    isLiked: false,
    replyToAuthorName: "Hoàng Nam",
  },
  // Comments on post-2
  {
    id: "comm-8",
    postId: "post-2",
    parentId: null,
    author: {
      id: "user-1",
      name: "Lê Bảo",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    content: "Hội An buổi sáng sớm vắng vẻ chụp ảnh hoa giấy là đẹp nhất rồi!",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    likeCount: 6,
    isLiked: true,
  },
  {
    id: "comm-9",
    postId: "post-2",
    parentId: "comm-8",
    author: {
      id: "user-2",
      name: "Minh Trang",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    },
    content: "Đúng rồi bạn, tầm 6h sáng chưa có khách du lịch không khí yên tĩnh lắm.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    likeCount: 2,
    isLiked: false,
    replyToAuthorName: "Lê Bảo",
  },
];

export class MockSocialPostRepository implements ISocialPostRepository {
  private posts: SocialPost[] = [...INITIAL_MOCK_POSTS];
  private comments: PostComment[] = [...INITIAL_MOCK_COMMENTS];

  async listPosts(params: ListPostsParams = {}): Promise<SocialPostPageResponse> {
    // Simulate brief network delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    let filtered = [...this.posts];
    if (params.userId) {
      filtered = filtered.filter((p) => p.author.id === params.userId);
    }

    const page = params.page ?? 0;
    const size = params.size ?? 10;
    const startIndex = page * size;
    const items = filtered.slice(startIndex, startIndex + size);

    return {
      items,
      total: filtered.length,
      page,
      size,
      hasMore: startIndex + size < filtered.length,
    };
  }

  async getPostById(postId: string): Promise<SocialPost> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const post = this.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error("Không tìm thấy bài viết hoặc bài viết đã bị xóa.");
    }
    return post;
  }

  async createPost(payload: CreateSocialPostRequest, _idempotencyKey?: string): Promise<SocialPost> {
    void _idempotencyKey;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const currentUser = useAuthStore.getState().user;

    const newPost: SocialPost = {
      id: `post-${Date.now()}`,
      author: {
        id: currentUser?.id || "guest-user",
        name: currentUser?.name || currentUser?.email?.split("@")[0] || "Khách",
        avatar: currentUser?.avatar,
        email: currentUser?.email,
      },
      content: payload.content.trim(),
      mediaUrls: payload.media?.map((item) => item.secureUrl) || [],
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
    };

    this.posts.unshift(newPost);
    return newPost;
  }

  async getUploadSignature(): Promise<UploadSignatureResponse> {
    return {
      cloudName: "mock",
      apiKey: "mock",
      timestamp: Date.now(),
      signature: "mock",
      folder: "mock",
      resourceType: "image",
      allowedFormats: ["jpg"],
    };
  }

  async deletePost(postId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const index = this.posts.findIndex((p) => p.id === postId);
    if (index === -1) {
      throw new Error("Không tìm thấy bài viết cần xóa.");
    }
    this.posts.splice(index, 1);
    this.comments = this.comments.filter((c) => c.postId !== postId);
  }

  async getUserPosts(userId: string, params: ListPostsParams = {}): Promise<SocialPostPageResponse> {
    return this.listPosts({ ...params, userId });
  }

  async toggleLikePost(postId: string, currentLiked?: boolean): Promise<ToggleLikeResponse> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const post = this.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error("Không tìm thấy bài viết.");
    }

    const nextLiked = currentLiked !== undefined ? !currentLiked : !post.isLiked;
    post.isLiked = nextLiked;
    post.likeCount = Math.max(0, post.likeCount + (nextLiked ? 1 : -1));

    return {
      liked: post.isLiked,
      likeCount: post.likeCount,
    };
  }

  async listComments(postId: string): Promise<PostComment[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return this.comments.filter((c) => c.postId === postId);
  }

  async createComment(postId: string, payload: CreateCommentRequest): Promise<PostComment> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const post = this.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error("Không tìm thấy bài viết.");
    }

    const currentUser = useAuthStore.getState().user;
    let replyToAuthorName: string | undefined;

    if (payload.parentId) {
      const parent = this.comments.find((c) => c.id === payload.parentId);
      if (parent) {
        replyToAuthorName = parent.author.name;
      }
    }

    const newComment: PostComment = {
      id: `comm-${Date.now()}`,
      postId,
      parentId: payload.parentId || null,
      author: {
        id: currentUser?.id || "guest-user",
        name: currentUser?.name || currentUser?.email?.split("@")[0] || "Bạn",
        avatar: currentUser?.avatar,
        email: currentUser?.email,
      },
      content: payload.content.trim(),
      createdAt: new Date().toISOString(),
      likeCount: 0,
      isLiked: false,
      replyToAuthorName,
    };

    this.comments.push(newComment);
    post.commentCount = (post.commentCount || 0) + 1;

    return newComment;
  }

  async toggleLikeComment(
    _postId: string,
    commentId: string,
    currentLiked?: boolean
  ): Promise<ToggleLikeResponse> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) {
      throw new Error("Không tìm thấy bình luận.");
    }

    const nextLiked = currentLiked !== undefined ? !currentLiked : !comment.isLiked;
    comment.isLiked = nextLiked;
    comment.likeCount = Math.max(0, comment.likeCount + (nextLiked ? 1 : -1));

    return {
      liked: comment.isLiked,
      likeCount: comment.likeCount,
    };
  }
}
