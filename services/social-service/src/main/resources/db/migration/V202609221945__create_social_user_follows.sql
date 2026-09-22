CREATE TABLE social_user_follows (
    follower_user_id UUID NOT NULL,
    followed_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_user_id, followed_user_id),
    CHECK (follower_user_id <> followed_user_id)
);

CREATE INDEX idx_social_user_follows_followed ON social_user_follows (followed_user_id, created_at DESC, follower_user_id);
CREATE INDEX idx_social_user_follows_follower ON social_user_follows (follower_user_id, created_at DESC);
