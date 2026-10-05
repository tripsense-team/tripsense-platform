CREATE TABLE social_posts (
    id UUID PRIMARY KEY,
    author_id UUID NOT NULL,
    author_display_name VARCHAR(255) NOT NULL,
    author_email VARCHAR(255),
    content TEXT NOT NULL DEFAULT '',
    like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by_user_id UUID NULL
);
CREATE TABLE social_post_media (
    id UUID PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    public_id VARCHAR(512) NOT NULL,
    secure_url TEXT NOT NULL,
    resource_type VARCHAR(16) NOT NULL CHECK (resource_type = 'image'),
    format VARCHAR(32),
    width INTEGER,
    height INTEGER,
    sort_order SMALLINT NOT NULL CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (post_id, sort_order),
    UNIQUE (post_id, public_id)
);
CREATE TABLE social_post_likes (
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (post_id, user_id)
);
CREATE TABLE social_comments (
    id UUID PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    parent_comment_id UUID NULL REFERENCES social_comments(id),
    author_id UUID NOT NULL,
    author_display_name VARCHAR(255) NOT NULL,
    author_email VARCHAR(255),
    content TEXT NOT NULL,
    like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by_user_id UUID NULL
);
CREATE TABLE social_comment_likes (
    comment_id UUID NOT NULL REFERENCES social_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX social_posts_feed_active_idx ON social_posts (created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX social_posts_author_active_idx ON social_posts (author_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX social_comments_post_created_idx ON social_comments (post_id, created_at, id);
CREATE INDEX social_comments_post_parent_idx ON social_comments (post_id, parent_comment_id, created_at, id);
