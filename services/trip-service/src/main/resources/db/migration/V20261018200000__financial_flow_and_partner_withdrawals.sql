-- Financial flow, Escrow, Partner Wallets, Withdrawals and Customer Refunds

CREATE TABLE IF NOT EXISTS partner_payout_account (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    bank_code VARCHAR(32) NOT NULL,
    bank_name VARCHAR(128) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    account_holder_name VARCHAR(128) NOT NULL,
    branch_name VARCHAR(128),
    is_verified BOOLEAN NOT NULL DEFAULT true,
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_business_payout_account UNIQUE (business_id)
);

CREATE TABLE IF NOT EXISTS partner_wallet (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    available_balance NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
    locked_balance NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
    total_withdrawn NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn >= 0),
    total_earned NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (total_earned >= 0),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_business_wallet UNIQUE (business_id)
);

CREATE TABLE IF NOT EXISTS customer_refund_request (
    id UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES hotel_booking(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    reason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
    bank_code VARCHAR(32) NOT NULL,
    bank_name VARCHAR(128) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    account_holder_name VARCHAR(128) NOT NULL,
    bank_reference_code VARCHAR(128),
    proof_image_url VARCHAR(500),
    admin_notes TEXT,
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_booking_refund UNIQUE (booking_id)
);
CREATE INDEX IF NOT EXISTS idx_refund_status ON customer_refund_request(status, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_withdrawal_request (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id),
    wallet_id UUID NOT NULL REFERENCES partner_wallet(id),
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
    bank_code VARCHAR(32) NOT NULL,
    bank_name VARCHAR(128) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    account_holder_name VARCHAR(128) NOT NULL,
    bank_reference_code VARCHAR(128),
    proof_image_url VARCHAR(500),
    admin_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_biz ON partner_withdrawal_request(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON partner_withdrawal_request(status, created_at DESC);

CREATE TABLE IF NOT EXISTS financial_ledger_entry (
    id UUID PRIMARY KEY,
    wallet_id UUID REFERENCES partner_wallet(id) ON DELETE SET NULL,
    business_id UUID REFERENCES partner_business(id) ON DELETE SET NULL,
    entry_type VARCHAR(32) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    balance_after NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    reference_type VARCHAR(32) NOT NULL,
    reference_id UUID NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_ledger_business ON financial_ledger_entry(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON financial_ledger_entry(reference_type, reference_id);
