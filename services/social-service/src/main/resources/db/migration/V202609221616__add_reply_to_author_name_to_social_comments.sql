ALTER TABLE social_comments
    ADD COLUMN IF NOT EXISTS reply_to_author_name VARCHAR(255) NULL;
