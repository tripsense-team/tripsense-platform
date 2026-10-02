-- V20260928143500__partner_onboarding_and_business_approval.sql
-- Format: YYYYMMDDHHMMSS for unique monotonic timestamp migration

CREATE TABLE partner_business (
    id uuid PRIMARY KEY,
    kind varchar(30) NOT NULL CHECK (kind IN ('HOTEL', 'RESTAURANT', 'TOUR_GUIDE')),
    owner_user_id uuid NOT NULL,
    display_name varchar(255) NOT NULL,
    draft_profile_json jsonb,
    draft_schema_version integer NOT NULL DEFAULT 1,
    approval_validity varchar(20) NOT NULL DEFAULT 'NONE' CHECK (approval_validity IN ('NONE', 'VALID', 'REVOKED')),
    operation_state varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (operation_state IN ('ACTIVE', 'SUSPENDED')),
    publication_state varchar(20) NOT NULL DEFAULT 'HIDDEN' CHECK (publication_state IN ('HIDDEN', 'PUBLISHED')),
    accepting_new boolean NOT NULL DEFAULT false,
    requires_reverification boolean NOT NULL DEFAULT false,
    reverification_application_id uuid,
    suspension_version integer NOT NULL DEFAULT 0,
    suspended_at timestamptz,
    reinstated_at timestamptz,
    approved_revision_id uuid,
    version bigint NOT NULL DEFAULT 0,
    contact_consent_version varchar(50),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX partner_business_guide_owner ON partner_business(owner_user_id) WHERE kind = 'TOUR_GUIDE';
CREATE INDEX idx_partner_biz_owner ON partner_business(owner_user_id, created_at, id);
CREATE INDEX idx_partner_biz_lookup ON partner_business(kind, publication_state, created_at, id);

CREATE TABLE partner_business_member (
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    role varchar(30) NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
    state varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE', 'REVOKED')),
    version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id, user_id)
);

CREATE INDEX idx_partner_member_user ON partner_business_member(user_id, state);

CREATE TABLE partner_application (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    revision integer NOT NULL,
    profile_snapshot jsonb NOT NULL,
    checklist_id varchar(100),
    checklist_version varchar(50),
    requested_capabilities jsonb NOT NULL,
    state varchar(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (state IN ('DRAFT', 'SUBMITTED', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    is_reverification boolean NOT NULL DEFAULT false,
    version bigint NOT NULL DEFAULT 0,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_id, revision)
);

CREATE UNIQUE INDEX idx_partner_app_submitted ON partner_application(business_id) WHERE state = 'SUBMITTED';
CREATE INDEX idx_partner_app_queue ON partner_application(state, submitted_at, id);

ALTER TABLE partner_business
    ADD CONSTRAINT fk_partner_biz_reverification_app
    FOREIGN KEY (reverification_application_id) REFERENCES partner_application(id) ON DELETE SET NULL;

CREATE TABLE partner_review_checklist (
    id varchar(100) NOT NULL,
    kind varchar(30) NOT NULL,
    region varchar(50) NOT NULL DEFAULT 'GLOBAL',
    version varchar(50) NOT NULL,
    items_json jsonb NOT NULL,
    effective_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, version)
);

CREATE TABLE partner_checklist_result (
    application_id uuid NOT NULL REFERENCES partner_application(id) ON DELETE CASCADE,
    item_code varchar(100) NOT NULL,
    result varchar(20) NOT NULL CHECK (result IN ('PASS', 'FAIL', 'NEEDS_INFO')),
    reason varchar(1000),
    actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (application_id, item_code)
);

CREATE TABLE partner_business_capability (
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    capability varchar(50) NOT NULL CHECK (capability IN (
        'HOTEL_LISTING', 'HOTEL_INVENTORY', 'HOTEL_BOOKING',
        'RESTAURANT_LISTING', 'RESTAURANT_MENU',
        'GUIDE_LISTING', 'GUIDE_PROMOTION', 'GUIDE_INQUIRY'
    )),
    application_id uuid REFERENCES partner_application(id),
    granted_at timestamptz NOT NULL DEFAULT now(),
    granted_by uuid NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    PRIMARY KEY (business_id, capability)
);

CREATE TABLE partner_review_audit (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    application_id uuid REFERENCES partner_application(id),
    actor_id uuid NOT NULL,
    action varchar(50) NOT NULL,
    reason varchar(2000),
    from_state varchar(50),
    to_state varchar(50),
    business_version bigint NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_review_audit ON partner_review_audit(business_id, occurred_at);

CREATE TABLE partner_invitation (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    recipient_email varchar(255) NOT NULL,
    role varchar(30) NOT NULL CHECK (role IN ('MANAGER', 'STAFF')),
    token_hash varchar(255) NOT NULL UNIQUE,
    state varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_partner_inv_pending ON partner_invitation(business_id, lower(recipient_email)) WHERE state = 'PENDING';

CREATE TABLE partner_document (
    id uuid PRIMARY KEY,
    business_id uuid REFERENCES partner_business(id) ON DELETE CASCADE,
    claim_id uuid,
    object_key varchar(500) NOT NULL,
    file_version varchar(100) NOT NULL,
    file_hash varchar(128) NOT NULL,
    file_name varchar(255) NOT NULL,
    content_type varchar(100) NOT NULL,
    size_bytes bigint NOT NULL,
    scan_state varchar(30) NOT NULL DEFAULT 'CLEAN' CHECK (scan_state IN ('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'REJECTED')),
    uploaded_by uuid NOT NULL,
    expires_at timestamptz,
    retention_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_doc_biz ON partner_document(business_id, scan_state);
CREATE INDEX idx_partner_doc_claim ON partner_document(claim_id);

CREATE TABLE partner_application_document (
    application_id uuid NOT NULL REFERENCES partner_application(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES partner_document(id) ON DELETE CASCADE,
    document_version varchar(100) NOT NULL,
    document_hash varchar(128) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (application_id, document_id)
);

CREATE TABLE partner_management_claim (
    id uuid PRIMARY KEY,
    applicant_user_id uuid NOT NULL,
    target_business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    reason varchar(2000) NOT NULL,
    state varchar(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (state IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RESOLVED_INVITATION', 'REJECTED', 'DISPUTED', 'DISTINCT_BUSINESS_ALLOWED')),
    version bigint NOT NULL DEFAULT 0,
    decision_outcome varchar(50),
    decision_reason varchar(2000),
    decided_by uuid,
    decided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_partner_claim_active ON partner_management_claim(applicant_user_id, target_business_id) WHERE state IN ('SUBMITTED', 'UNDER_REVIEW');
CREATE INDEX idx_partner_claim_queue ON partner_management_claim(state, created_at, id);

CREATE TABLE partner_inquiry_contact_consent (
    inquiry_id uuid NOT NULL,
    grantor_user_id uuid NOT NULL,
    channel varchar(20) NOT NULL CHECK (channel IN ('EMAIL', 'PHONE')),
    grantee_user_id uuid NOT NULL,
    state varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE', 'REVOKED')),
    consented_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    revoked_reason varchar(500),
    PRIMARY KEY (inquiry_id, grantor_user_id, channel)
);

CREATE TABLE partner_restaurant_menu_item (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    name varchar(160) NOT NULL,
    description varchar(1000),
    price numeric(16, 2) NOT NULL CHECK (price >= 0),
    currency varchar(3) NOT NULL DEFAULT 'VND',
    is_available boolean NOT NULL DEFAULT true,
    version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_menu_biz ON partner_restaurant_menu_item(business_id, is_available);

CREATE TABLE guide_promotion (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    publication_state varchar(20) NOT NULL DEFAULT 'HIDDEN' CHECK (publication_state IN ('HIDDEN', 'PUBLISHED', 'ARCHIVED')),
    approved_revision_id uuid,
    version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guide_promo_biz ON guide_promotion(business_id, publication_state, created_at, id);

CREATE TABLE guide_promotion_revision (
    id uuid PRIMARY KEY,
    promotion_id uuid NOT NULL REFERENCES guide_promotion(id) ON DELETE CASCADE,
    revision integer NOT NULL,
    profile_revision_id uuid,
    title varchar(160) NOT NULL,
    description varchar(4000) NOT NULL,
    expertise_refs jsonb NOT NULL,
    skill_ids text[] NOT NULL DEFAULT '{}',
    language_codes text[] NOT NULL DEFAULT '{}',
    audience_tags text[] NOT NULL DEFAULT '{}',
    suggested_duration_minutes integer NOT NULL DEFAULT 120,
    max_group_size integer NOT NULL DEFAULT 10,
    inclusions text[] NOT NULL DEFAULT '{}',
    exclusions text[] NOT NULL DEFAULT '{}',
    media_ids uuid[] NOT NULL DEFAULT '{}',
    indicative_price jsonb,
    is_material_change boolean NOT NULL DEFAULT false,
    previous_revision_id uuid REFERENCES guide_promotion_revision(id),
    state varchar(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (state IN ('DRAFT', 'SUBMITTED', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    version bigint NOT NULL DEFAULT 0,
    review_reason varchar(2000),
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (promotion_id, revision)
);

CREATE UNIQUE INDEX idx_guide_promo_rev_submitted ON guide_promotion_revision(promotion_id) WHERE state = 'SUBMITTED';

CREATE TABLE guide_community_distribution (
    promotion_id uuid PRIMARY KEY REFERENCES guide_promotion(id) ON DELETE CASCADE,
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    community_enabled boolean NOT NULL DEFAULT false,
    distribution_version bigint NOT NULL DEFAULT 1,
    desired_revision_id uuid,
    post_id uuid,
    sync_state varchar(30) NOT NULL DEFAULT 'PENDING_SYNC' CHECK (sync_state IN ('PENDING_SYNC', 'DISTRIBUTED', 'HIDDEN', 'REMOVED_BY_AUTHOR', 'REMOVED_BY_MODERATION', 'SYNC_FAILED', 'UNKNOWN')),
    last_error_code varchar(50),
    last_ack_version bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE guide_inquiry (
    id uuid PRIMARY KEY,
    guide_business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL,
    source_promotion_id uuid REFERENCES guide_promotion(id),
    source_community_post_id uuid,
    source_revision_snapshot jsonb NOT NULL,
    state varchar(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (state IN ('SUBMITTED', 'IN_DISCUSSION', 'PROPOSAL_SENT', 'CONTACT_AGREED', 'DECLINED', 'WITHDRAWN', 'EXPIRED', 'CLOSED')),
    version bigint NOT NULL DEFAULT 0,
    bound_suspension_version integer NOT NULL DEFAULT 0,
    current_requirements_revision integer NOT NULL DEFAULT 1,
    current_proposal_id uuid,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_guide_inq_active ON guide_inquiry(customer_id, guide_business_id) WHERE state IN ('SUBMITTED', 'IN_DISCUSSION', 'PROPOSAL_SENT');
CREATE INDEX idx_guide_inq_customer ON guide_inquiry(customer_id, created_at, id);
CREATE INDEX idx_guide_inq_biz ON guide_inquiry(guide_business_id, state, created_at, id);
CREATE INDEX idx_guide_inq_expiry ON guide_inquiry(expires_at, id) WHERE state NOT IN ('CONTACT_AGREED', 'DECLINED', 'WITHDRAWN', 'EXPIRED', 'CLOSED');

CREATE TABLE guide_inquiry_requirements (
    inquiry_id uuid NOT NULL REFERENCES guide_inquiry(id) ON DELETE CASCADE,
    revision integer NOT NULL,
    data jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (inquiry_id, revision)
);

CREATE TABLE guide_proposal (
    id uuid PRIMARY KEY,
    inquiry_id uuid NOT NULL REFERENCES guide_inquiry(id) ON DELETE CASCADE,
    revision integer NOT NULL,
    requirements_revision integer NOT NULL,
    proposal_data jsonb NOT NULL,
    guide_consent_snapshot jsonb NOT NULL,
    author_id uuid NOT NULL,
    valid_until timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (inquiry_id, revision)
);

CREATE TABLE guide_inquiry_entry (
    id uuid PRIMARY KEY,
    inquiry_id uuid NOT NULL REFERENCES guide_inquiry(id) ON DELETE CASCADE,
    seq integer NOT NULL,
    actor_id uuid NOT NULL,
    role_snapshot varchar(30) NOT NULL,
    kind varchar(30) NOT NULL CHECK (kind IN ('QUESTION', 'REPLY', 'REQUIREMENTS_CHANGED', 'PROPOSAL', 'DECISION')),
    body varchar(2000),
    payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (inquiry_id, seq)
);

CREATE TABLE guide_inquiry_block (
    guide_business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL,
    blocked_by_side varchar(20) NOT NULL CHECK (blocked_by_side IN ('CUSTOMER', 'GUIDE')),
    actor_id uuid NOT NULL,
    reason varchar(500),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (guide_business_id, customer_id, blocked_by_side)
);

CREATE TABLE partner_customer_quota (
    customer_id uuid NOT NULL,
    quota_date date NOT NULL,
    new_inquiries_count integer NOT NULL DEFAULT 0,
    open_inquiries_count integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (customer_id, quota_date)
);

CREATE TABLE partner_support_case (
    id uuid PRIMARY KEY,
    resource_type varchar(30) NOT NULL CHECK (resource_type IN ('HOTEL_BOOKING', 'GUIDE_INQUIRY', 'GUIDE_PROMOTION', 'MANAGEMENT_CLAIM')),
    resource_id uuid NOT NULL,
    claim_id uuid REFERENCES partner_management_claim(id),
    business_id uuid REFERENCES partner_business(id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL,
    assigned_admin_id uuid,
    assigned_admin uuid,
    category varchar(50) NOT NULL,
    reason varchar(2000) NOT NULL,
    state varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
    version bigint NOT NULL DEFAULT 0,
    resolution_action varchar(50),
    resolution_note varchar(2000),
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_support_admin ON partner_support_case(assigned_admin_id, state, created_at, id);
CREATE INDEX idx_partner_support_resource ON partner_support_case(resource_type, resource_id);

CREATE TABLE partner_outbox (
    id uuid PRIMARY KEY,
    event_id uuid NOT NULL UNIQUE,
    aggregate_type varchar(50) NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type varchar(60) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    next_attempt timestamptz NOT NULL DEFAULT now(),
    dead_letter boolean NOT NULL DEFAULT false,
    last_error varchar(100)
);

CREATE INDEX idx_partner_outbox_pending ON partner_outbox(created_at) WHERE processed_at IS NULL;
CREATE INDEX idx_partner_outbox_due ON partner_outbox(next_attempt) WHERE processed_at IS NULL AND dead_letter = false;

CREATE TABLE guide_public_search (
    business_id uuid PRIMARY KEY REFERENCES partner_business(id) ON DELETE CASCADE,
    approved_revision_id uuid,
    area_ids text[] NOT NULL DEFAULT '{}',
    topic_ids text[] NOT NULL DEFAULT '{}',
    skill_ids text[] NOT NULL DEFAULT '{}',
    language_codes text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guide_search_areas ON guide_public_search USING GIN (area_ids);
CREATE INDEX idx_guide_search_topics ON guide_public_search USING GIN (topic_ids);
CREATE INDEX idx_guide_search_skills ON guide_public_search USING GIN (skill_ids);
CREATE INDEX idx_guide_search_languages ON guide_public_search USING GIN (language_codes);
