ALTER TABLE social_reports ALTER COLUMN post_id DROP NOT NULL;
ALTER TABLE social_reports DROP CONSTRAINT social_reports_target_type_chk;
ALTER TABLE social_reports ADD CONSTRAINT social_reports_target_type_chk
    CHECK (target_type IN ('POST', 'COMMENT', 'PLACE_REVIEW'));
ALTER TABLE social_reports ADD CONSTRAINT social_reports_target_shape_chk
    CHECK ((target_type IN ('POST', 'COMMENT') AND post_id IS NOT NULL)
        OR (target_type = 'PLACE_REVIEW' AND post_id IS NULL));
