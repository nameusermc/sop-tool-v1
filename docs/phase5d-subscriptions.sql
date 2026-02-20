-- ============================================================================
-- SUBSCRIPTIONS TABLE — Paddle webhook data
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- ============================================================================

-- Table: stores Paddle subscription state per customer email
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_email TEXT NOT NULL,
    paddle_subscription_id TEXT,
    paddle_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',   -- active, canceled, past_due, paused
    plan TEXT NOT NULL DEFAULT 'pro',        -- currently only 'pro', future: tiers
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on email — one subscription per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_email 
    ON subscriptions(customer_email);

-- Index on status for quick lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
    ON subscriptions(status);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own subscription (matched by auth email)
CREATE POLICY "Users can read own subscription"
    ON subscriptions FOR SELECT
    USING (customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Policy: Service role can do everything (for webhook writes)
-- The service_role key bypasses RLS by default, so no explicit policy needed.
-- But we add this for clarity if you ever use a custom role.
CREATE POLICY "Service role full access"
    ON subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- PUBLIC READ FUNCTION (for checking subscription without full auth)
-- This lets the app check subscription status using just an email.
-- Uses SECURITY DEFINER so it runs with table owner privileges.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_subscription_status(lookup_email TEXT)
RETURNS TABLE (
    status TEXT,
    plan TEXT,
    paddle_subscription_id TEXT,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        s.status,
        s.plan,
        s.paddle_subscription_id,
        s.updated_at
    FROM subscriptions s
    WHERE s.customer_email = LOWER(TRIM(lookup_email))
    LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_subscription_status(TEXT) TO authenticated;
