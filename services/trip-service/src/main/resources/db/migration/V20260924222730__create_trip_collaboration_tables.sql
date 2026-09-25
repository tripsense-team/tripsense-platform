-- Migration: Create Trip Collaboration & Members tables
-- Tasks: TF-76, TF-77, TF-78, TF-79, TF-80, TF-81

CREATE TABLE IF NOT EXISTS trip_members (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'VIEWER',
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_trip_members_role CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
    CONSTRAINT uq_trip_members_trip_user UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);

CREATE TABLE IF NOT EXISTS trip_invitations (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    inviter_user_id UUID NOT NULL,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_user_id UUID,
    role VARCHAR(32) NOT NULL DEFAULT 'EDITOR',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    invitation_token VARCHAR(255) NOT NULL UNIQUE,
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_trip_invitations_role CHECK (role IN ('EDITOR', 'VIEWER')),
    CONSTRAINT ck_trip_invitations_status CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_trip_invitations_trip_id ON trip_invitations(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_invitee_email_status ON trip_invitations(invitee_email, status);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_invitee_user_id ON trip_invitations(invitee_user_id);

-- Partial unique index to prevent duplicate pending invites per email
CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_invitations_pending 
ON trip_invitations(trip_id, invitee_email) 
WHERE status = 'PENDING';

-- Backfill existing trips with their owners as OWNER in trip_members
INSERT INTO trip_members (id, trip_id, user_id, role, joined_at, created_at, updated_at)
SELECT gen_random_uuid(), id, owner_user_id, 'OWNER', created_at, created_at, updated_at
FROM trips
ON CONFLICT (trip_id, user_id) DO NOTHING;

