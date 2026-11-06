CREATE TABLE IF NOT EXISTS social_post_saves (
    user_id UUID NOT NULL,
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS social_post_saves_user_cursor_idx
    ON social_post_saves (user_id, created_at DESC, post_id DESC);
