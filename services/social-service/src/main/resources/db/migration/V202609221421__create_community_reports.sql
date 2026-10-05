CREATE TABLE IF NOT EXISTS social_reports (
    id UUID PRIMARY KEY,
    target_type VARCHAR(16) NOT NULL,
    target_id UUID NOT NULL,
    post_id UUID NOT NULL,
    reporter_id UUID NOT NULL,
    reason VARCHAR(32) NOT NULL,
    details VARCHAR(500),
    status VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    moderator_note VARCHAR(500),
    CONSTRAINT social_reports_target_type_chk CHECK (target_type IN ('POST', 'COMMENT')),
    CONSTRAINT social_reports_reason_chk CHECK (reason IN ('SPAM', 'HARASSMENT', 'DANGEROUS_CONTENT', 'PRIVACY', 'MISINFORMATION', 'OTHER')),
    CONSTRAINT social_reports_status_chk CHECK (status IN ('PENDING', 'DISMISSED', 'ACTIONED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS social_reports_reporter_target_unique_idx
    ON social_reports (reporter_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS social_reports_moderation_queue_idx
    ON social_reports (status, created_at, id);

CREATE INDEX IF NOT EXISTS social_reports_reporter_throttle_idx
    ON social_reports (reporter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_moderation_audit (
    id UUID PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES social_reports(id),
    moderator_id UUID NOT NULL,
    action VARCHAR(32) NOT NULL,
    target_type VARCHAR(16) NOT NULL,
    target_id UUID NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT social_moderation_audit_action_chk CHECK (action IN ('DISMISS', 'REMOVE_CONTENT'))
);

CREATE INDEX IF NOT EXISTS social_moderation_audit_report_idx
    ON social_moderation_audit (report_id, created_at);
