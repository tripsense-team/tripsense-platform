ALTER TABLE social_posts ADD COLUMN idempotency_key UUID NULL;
CREATE UNIQUE INDEX social_posts_author_idempotency_key_idx
    ON social_posts (author_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
