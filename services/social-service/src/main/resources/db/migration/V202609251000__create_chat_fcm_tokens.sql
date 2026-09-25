CREATE TABLE IF NOT EXISTS chat_fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    fcm_token TEXT NOT NULL,
    device_type VARCHAR(50) NOT NULL DEFAULT 'WEB',
    user_agent TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chat_fcm_token UNIQUE (fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_chat_fcm_tokens_user_id ON chat_fcm_tokens(user_id);
