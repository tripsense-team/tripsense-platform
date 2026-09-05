import type { PostComment } from "../types";

export const MAX_VISUAL_DEPTH = 2;

export interface FlattenedCommentNode {
  comment: PostComment;
  actualDepth: number;
  visualDepth: number; // Math.min(actualDepth, MAX_VISUAL_DEPTH)
  replyToAuthorName?: string;
}

/**
 * Builds a flattened tree list of comments in pre-order depth-first traversal (DFS).
 * Ensures that visual indentation is clamped to MAX_VISUAL_DEPTH (2).
 * For any reply (actualDepth > 0), provides the replyToAuthorName so the UI
 * can display "Trả lời @TênUser".
 */
export function buildFlattenedCommentTree(
  comments: PostComment[]
): FlattenedCommentNode[] {
  if (!comments || comments.length === 0) {
    return [];
  }

  const commentMap = new Map<string, PostComment>();
  const childrenMap = new Map<string, PostComment[]>();
  const rootComments: PostComment[] = [];

  for (const c of comments) {
    commentMap.set(c.id, c);
  }

  for (const c of comments) {
    if (c.parentId && commentMap.has(c.parentId)) {
      const list = childrenMap.get(c.parentId) || [];
      list.push(c);
      childrenMap.set(c.parentId, list);
    } else {
      rootComments.push(c);
    }
  }

  // Sort root comments by createdAt descending (bình luận mới ở đầu)
  rootComments.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );


  const result: FlattenedCommentNode[] = [];

  function traverse(comment: PostComment, depth: number, parentAuthor?: string) {
    const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);
    const replyToAuthorName =
      depth > 0 ? (parentAuthor || comment.replyToAuthorName) : undefined;

    result.push({
      comment,
      actualDepth: depth,
      visualDepth,
      replyToAuthorName,
    });

    const children = childrenMap.get(comment.id) || [];
    children.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const child of children) {
      traverse(child, depth + 1, comment.author.name);
    }
  }

  for (const root of rootComments) {
    traverse(root, 0);
  }

  return result;
}
