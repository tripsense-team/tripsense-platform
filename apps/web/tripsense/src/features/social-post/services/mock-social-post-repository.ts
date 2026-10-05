import { useAuthStore } from "@/features/auth/store/use-auth-store";
import type {
  CreateCommentRequest,
  CreateSocialPostRequest,
  CreateTripShareRequest,
  ListPostsParams,
  PostComment,
  SocialPost,
  SocialPostPageResponse,
  ToggleLikeResponse,
  TripShareDetailResponse,
  TripSharePreviewResponse,
  RefreshTripSharePublicationRequest,
  SubmitCommunityReportRequest,
  ReportReceiptResponse,
  ModerationReport,
  ModerationReportPage,
  UploadSignatureResponse,
} from "../types";
import type { ISocialPostRepository } from "./social-post-repository";

const INITIAL_MOCK_POSTS: SocialPost[] = [
  {
    id: "post-1",
    author: {
      id: "user-1",
      name: "Lê Bảo",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      email: "lebao@tripsense.app",
    },
    content:
      "Hoàng hôn tuyệt đẹp nhìn từ đỉnh Bàn Cờ, Bán đảo Sơn Trà. Đà Nẵng mùa này thời tiết thật sự trong lành và gió mát rượi!",
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
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      email: "trang.minh@tripsense.app",
    },
    content:
      "Một góc phố cổ Hội An bình yên vào buổi sớm mai. Những bức tường vàng rêu phong và giàn hoa giấy nở rực rỡ dưới nắng.",
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
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      email: "nam.hoang@tripsense.app",
    },
    content:
      "Chuyến trekking Tà Xùa săn mây lần thứ 3 trong năm. Cảm giác đứng trên sống lưng khủng long ngắm biển mây cuồn cuộn vẫn vẹn nguyên như ngày đầu.",
    mediaUrls: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop&q=80",
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
      avatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
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
      avatar:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
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
      avatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    },
    content:
      "Nói thật chứ đi mùa này nắng nhẹ gió mát, đứng ngắm hoàng hôn chill không muốn về.",
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
      avatar:
        "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    },
    content:
      "660 hai ông thế đó, hẹn hò ở Đỉnh Bàn Cờ mà không hú anh em gì hết trơn!",
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
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    content:
      "Cuối tuần sau làm kèo picnic trên Sơn Trà lại đê mọi người ơi! 🛵🌅",
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
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
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
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    content:
      "Cảm ơn Nam nhé, đợt này đi vào tầm 4h30 chiều là ánh sáng đẹp nhất.",
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
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
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
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    },
    content:
      "Đúng rồi bạn, tầm 6h sáng chưa có khách du lịch không khí yên tĩnh lắm.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    likeCount: 2,
    isLiked: false,
    replyToAuthorName: "Lê Bảo",
  },
];

export class MockSocialPostRepository implements ISocialPostRepository {
  private posts: SocialPost[] = [...INITIAL_MOCK_POSTS];
  private comments: PostComment[] = [...INITIAL_MOCK_COMMENTS];
  private sourceTripIds = new Map<string, string>();

  async listPosts(
    params: ListPostsParams = {},
  ): Promise<SocialPostPageResponse> {
    // Simulate brief network delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    let filtered = [...this.posts];
    if (params.userId) {
      filtered = filtered.filter((p) => p.author.id === params.userId);
    }
    if (params.type && params.type !== "ALL") {
      filtered = filtered.filter(
        (post) => (post.type ?? "STANDARD") === params.type,
      );
    }

    const page = params.page ?? 0;
    const size = params.size ?? 20;
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

  async createPost(
    payload: CreateSocialPostRequest,
    _idempotencyKey?: string,
  ): Promise<SocialPost> {
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

  async getUserPosts(
    userId: string,
    params: ListPostsParams = {},
  ): Promise<SocialPostPageResponse> {
    return this.listPosts({ ...params, userId });
  }

  async toggleLikePost(
    postId: string,
    currentLiked?: boolean,
  ): Promise<ToggleLikeResponse> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const post = this.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error("Không tìm thấy bài viết.");
    }

    const nextLiked =
      currentLiked !== undefined ? !currentLiked : !post.isLiked;
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

  async createComment(
    postId: string,
    payload: CreateCommentRequest,
  ): Promise<PostComment> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const post = this.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error("Không tìm thấy bài viết.");
    }

    const currentUser = useAuthStore.getState().user;
    let effectiveParentId: string | null = null;
    let replyToAuthorName: string | undefined;

    if (payload.parentId) {
      const targetParent = this.comments.find((c) => c.id === payload.parentId);
      if (targetParent) {
        replyToAuthorName = targetParent.author.name;
        if (!targetParent.parentId) {
          // targetParent is Level 1 (Root) -> new comment is Level 2
          effectiveParentId = targetParent.id;
        } else {
          // targetParent has a parent. Check if grandparent is root or level 2
          const grandparent = this.comments.find(
            (c) => c.id === targetParent.parentId,
          );
          if (!grandparent || !grandparent.parentId) {
            // grandparent is root -> targetParent is Level 2 -> new comment is Level 3
            effectiveParentId = targetParent.id;
          } else {
            // grandparent is Level 2+ -> targetParent is ALREADY Level 3+
            // CLAMP: Tree max depth is 3 generations. Anchor new comment to targetParent's parent as sibling.
            effectiveParentId = targetParent.parentId;
          }
        }
      }
    }

    const newComment: PostComment = {
      id: `comm-${Date.now()}`,
      postId,
      parentId: effectiveParentId,
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
    currentLiked?: boolean,
  ): Promise<ToggleLikeResponse> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) {
      throw new Error("Không tìm thấy bình luận.");
    }

    const nextLiked =
      currentLiked !== undefined ? !currentLiked : !comment.isLiked;
    comment.isLiked = nextLiked;
    comment.likeCount = Math.max(0, comment.likeCount + (nextLiked ? 1 : -1));

    return {
      liked: comment.isLiked,
      likeCount: comment.likeCount,
    };
  }

  async createTripShare(
    payload: CreateTripShareRequest,
    idempotencyKey: string,
  ): Promise<SocialPost> {
    void idempotencyKey;
    await new Promise((resolve) => setTimeout(resolve, 200));
    const currentUser = useAuthStore.getState().user;
    const newPost: SocialPost = {
      id: "post-" + Date.now(),
      type: "TRIP_SHARE",
      author: {
        id: currentUser?.id || "mock-user-1",
        name: currentUser?.name || "Bạn",
        avatar: currentUser?.avatar,
        email: currentUser?.email,
      },
      content: payload.caption || "",
      mediaUrls: [],
      visibility: payload.visibility || "PUBLIC",
      trip: {
        name: "Chuyến đi mẫu",
        destinationName: "Đà Nẵng",
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        coverImageUrl:
          "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&auto=format&fit=crop&q=80",
        dayCount: 4,
        itineraryItemCount: 6,
        highlights: [
          { title: "Cầu Rồng", placeName: "Cầu Rồng", dayNumber: 1 },
          {
            title: "Bãi biển Mỹ Khê",
            placeName: "Bãi biển Mỹ Khê",
            dayNumber: 2,
          },
        ],
      },
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
    };
    this.sourceTripIds.set(newPost.id, payload.tripId);
    this.posts.unshift(newPost);
    return newPost;
  }

  async previewTripShare(tripId: string): Promise<TripSharePreviewResponse> {
    const trip = this.posts.find(
      (post) => this.sourceTripIds.get(post.id) === tripId,
    )?.trip;
    return {
      snapshot: {
        schemaVersion: 1,
        publicationRevision: 1,
        publishedAt: null,
        datePrecision: "DAY_NUMBER_ONLY",
        timePrecision: "NONE",
        summary: {
          name: trip?.name || "Chuyến đi mẫu",
          destinationName: trip?.destinationName || "Đà Nẵng",
          coverImageUrl: trip?.coverImageUrl,
          dayCount: trip?.dayCount || 3,
          itineraryItemCount: 2,
          highlights: [
            { title: "Cầu Rồng", placeName: "Cầu Rồng", dayNumber: 1 },
          ],
        },
        days: [
          {
            dayNumber: 1,
            date: null,
            items: [
              {
                order: 1,
                title: "Cầu Rồng",
                type: "PLACE",
                placeName: "Cầu Rồng",
              },
            ],
          },
        ],
      },
      snapshotFingerprint: "a".repeat(64),
      consentVersion: "PUBLIC_TRIP_V1",
      warnings: ["EXACT_DATES_AND_TIMES_HIDDEN"],
    };
  }

  async refreshTripSharePublication(
    postId: string,
    _payload: RefreshTripSharePublicationRequest,
    _idempotencyKey: string,
  ): Promise<TripShareDetailResponse> {
    void _payload;
    void _idempotencyKey;
    return this.getTripShareDetail(postId);
  }

  async updatePostVisibility(
    postId: string,
    visibility: "PUBLIC" | "UNLISTED" | "PRIVATE",
  ): Promise<SocialPost> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const post = this.posts.find((p) => p.id === postId);
    if (!post) throw new Error("Không tìm thấy bài viết");
    post.visibility = visibility;
    return post;
  }

  async updatePostContent(
    postId: string,
    payload: { content: string },
  ): Promise<SocialPost> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const post = this.posts.find((p) => p.id === postId);
    if (!post) throw new Error("Không tìm thấy bài viết");
    post.content = payload.content.trim();
    post.updatedAt = new Date().toISOString();
    return post;
  }

  async getTripShareDetail(postId: string): Promise<TripShareDetailResponse> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const post = this.posts.find((p) => p.id === postId);
    if (!post) throw new Error("Không tìm thấy bài viết");
    return {
      post,
      publication: (
        await this.previewTripShare(this.sourceTripIds.get(postId) || "mock")
      ).snapshot,
      detailAvailability: "PUBLIC_SNAPSHOT",
      canManagePublication: true,
      sourceTripId: this.sourceTripIds.get(postId),
    };
  }

  async submitPostReport(
    _postId: string,
    _payload: SubmitCommunityReportRequest,
  ): Promise<ReportReceiptResponse> {
    void _postId;
    void _payload;
    return {
      id: crypto.randomUUID(),
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
  }

  async submitCommentReport(
    _postId: string,
    _commentId: string,
    _payload: SubmitCommunityReportRequest,
  ): Promise<ReportReceiptResponse> {
    void _postId;
    void _commentId;
    void _payload;
    return {
      id: crypto.randomUUID(),
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
  }

  async listModerationReports(
    _status: "PENDING" | "DISMISSED" | "ACTIONED" = "PENDING",
  ): Promise<ModerationReportPage> {
    void _status;
    return { items: [], total: 0, page: 0, size: 50, hasMore: false };
  }

  async decideModerationReport(
    _reportId: string,
    _action: "DISMISS" | "REMOVE_CONTENT",
    _note?: string,
  ): Promise<ModerationReport> {
    void _reportId;
    void _action;
    void _note;
    throw new Error("Không có báo cáo mock để xử lý.");
  }

  // --- Community Discovery Rail ---
  private creators: import("../types").SuggestedCreator[] = [
    {
      id: "creator-1",
      name: "Minh Hằng",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      niche: "Trekking & Cắm trại",
      nicheKey: "creatorNicheTrekking",
      followerCount: 1240,
      isFollowing: false,
      tripCount: 14,
    },
    {
      id: "creator-2",
      name: "Hoàng Long",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      niche: "Ẩm thực & Phố cổ",
      nicheKey: "creatorNicheFoodie",
      followerCount: 3890,
      isFollowing: false,
      tripCount: 28,
    },
    {
      id: "creator-3",
      name: "Khánh Linh",
      avatar:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      niche: "Nhiếp ảnh du lịch",
      nicheKey: "creatorNichePhotography",
      followerCount: 2150,
      isFollowing: true,
      tripCount: 19,
    },
    {
      id: "creator-4",
      name: "Tuấn Kiệt",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      niche: "Phượt xe máy & Khám phá",
      nicheKey: "creatorNicheRoadtrip",
      followerCount: 950,
      isFollowing: false,
      tripCount: 9,
    },
  ];

  private weatherPresets: Record<
    string,
    import("../types").DestinationWeather
  > = {
    dalat: {
      id: "dalat",
      cityName: "Đà Lạt",
      cityKey: "destinationDalat",
      temperature: 19,
      condition: "Mây nhẹ",
      conditionKey: "weatherConditionPartlyCloudy",
      tempRange: "14° – 22°",
      humidity: 75,
      iconType: "partlyCloudy",
      travelTip: "Thời tiết se lạnh lý tưởng để săn mây và đi cà phê",
      travelTipKey: "weatherTipDalat",
      updatedAt: "10 phút trước",
    },
    phuquoc: {
      id: "phuquoc",
      cityName: "Phú Quốc",
      cityKey: "destinationPhuQuoc",
      temperature: 29,
      condition: "Nắng ráo",
      conditionKey: "weatherConditionSunny",
      tempRange: "26° – 31°",
      humidity: 68,
      iconType: "sunny",
      travelTip: "Biển êm sóng nhẹ, rất thích hợp lặn ngắm san hô",
      travelTipKey: "weatherTipPhuQuoc",
      updatedAt: "15 phút trước",
    },
    danang: {
      id: "danang",
      cityName: "Đà Nẵng",
      cityKey: "destinationDaNang",
      temperature: 28,
      condition: "Nắng đẹp",
      conditionKey: "weatherConditionSunny",
      tempRange: "25° – 30°",
      humidity: 70,
      iconType: "sunny",
      travelTip:
        "Thời tiết hoàn hảo cho tắm biển Mỹ Khê và lên Bán đảo Sơn Trà",
      travelTipKey: "weatherTipDaNang",
      updatedAt: "5 phút trước",
    },
    hanoi: {
      id: "hanoi",
      cityName: "Hà Nội",
      cityKey: "destinationHaNoi",
      temperature: 24,
      condition: "Dịu mát",
      conditionKey: "weatherConditionCool",
      tempRange: "21° – 26°",
      humidity: 62,
      iconType: "cool",
      travelTip: "Gió mát nhẹ thích hợp dạo quanh Hồ Tây và Phố Cổ",
      travelTipKey: "weatherTipHaNoi",
      updatedAt: "20 phút trước",
    },
    sapa: {
      id: "sapa",
      cityName: "Sa Pa",
      cityKey: "destinationSaPa",
      temperature: 16,
      condition: "Se lạnh có sương",
      conditionKey: "weatherConditionCool",
      tempRange: "12° – 18°",
      humidity: 82,
      iconType: "cool",
      travelTip: "Nên chuẩn bị áo ấm khi lên đỉnh Fansipan",
      travelTipKey: "weatherTipSaPa",
      updatedAt: "12 phút trước",
    },
    ninhbinh: {
      id: "ninhbinh",
      cityName: "Ninh Bình",
      cityKey: "destinationNinhBinh",
      temperature: 26,
      condition: "Nắng nhẹ",
      conditionKey: "weatherConditionSunny",
      tempRange: "22° – 28°",
      humidity: 65,
      iconType: "sunny",
      travelTip: "Rất đẹp để chèo thuyền Tràng An và Tam Cốc",
      travelTipKey: "weatherTipNinhBinh",
      updatedAt: "8 phút trước",
    },
  };

  private trendingDestinations: import("../types").TrendingDestination[] = [
    {
      id: "trend-1",
      name: "Đà Lạt",
      cityNameKey: "destinationDalat",
      imageUrl:
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80",
      shareCountText: "1.4k chia sẻ",
      shareCount: 1420,
      subtitle: "Mùa hoa dã quỳ nở rộ",
      subtitleKey: "trendSubtitleDalat",
      slug: "da-lat",
    },
    {
      id: "trend-2",
      name: "Phú Quốc",
      cityNameKey: "destinationPhuQuoc",
      imageUrl:
        "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80",
      shareCountText: "980 chia sẻ",
      shareCount: 980,
      subtitle: "Hoàng hôn Bãi Sao và lặn biển",
      subtitleKey: "trendSubtitlePhuQuoc",
      slug: "phu-quoc",
    },
    {
      id: "trend-3",
      name: "Ninh Bình",
      cityNameKey: "destinationNinhBinh",
      imageUrl:
        "https://images.unsplash.com/photo-1528127269322-539801943592?w=600&auto=format&fit=crop&q=80",
      shareCountText: "760 chia sẻ",
      shareCount: 760,
      subtitle: "Chèo thuyền sông Ngô Đồng",
      subtitleKey: "trendSubtitleNinhBinh",
      slug: "ninh-binh",
    },
    {
      id: "trend-4",
      name: "Sa Pa",
      cityNameKey: "destinationSaPa",
      imageUrl:
        "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600&auto=format&fit=crop&q=80",
      shareCountText: "620 chia sẻ",
      shareCount: 620,
      subtitle: "Săn mây thung lũng Mường Hoa",
      subtitleKey: "trendSubtitleSaPa",
      slug: "sa-pa",
    },
  ];

  async getSuggestedCreators(): Promise<import("../types").SuggestedCreator[]> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return [...this.creators];
  }

  async toggleFollowCreator(
    creatorId: string,
    currentFollowing?: boolean,
  ): Promise<{ following: boolean; followerCount: number }> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const creator = this.creators.find((c) => c.id === creatorId);
    if (!creator) throw new Error("Không tìm thấy người dùng");

    const nextState =
      currentFollowing !== undefined ? !currentFollowing : !creator.isFollowing;
    creator.isFollowing = nextState;
    creator.followerCount = Math.max(
      0,
      creator.followerCount + (nextState ? 1 : -1),
    );

    return {
      following: creator.isFollowing,
      followerCount: creator.followerCount,
    };
  }

  async getDestinationWeather(
    cityId = "dalat",
  ): Promise<import("../types").DestinationWeather> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const target = this.weatherPresets[cityId] || this.weatherPresets.dalat;
    return { ...target };
  }

  async getTrendingDestinations(): Promise<
    import("../types").TrendingDestination[]
  > {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return [...this.trendingDestinations];
  }
}
