-- ============================================================================
-- PHASE 11: DAILY DIGEST EMAIL — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================================

-- RPC: get_daily_digest_data
-- Called by the Vercel cron serverless function (via service_role key).
-- Returns one row per team that had completions on the given date,
-- excluding owners who opted out via user_metadata.digest_optout.
--
-- Returns JSON array:
-- [
--   {
--     "owner_email": "owner@example.com",
--     "team_name": "My Team",
--     "team_id": "uuid",
--     "completions": [
--       { "member_name": "John", "sop_title": "Furnace Inspection", ... },
--       ...
--     ]
--   }
-- ]

CREATE OR REPLACE FUNCTION get_daily_digest_data(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start timestamptz;
    v_end timestamptz;
    v_result jsonb;
BEGIN
    -- Build time range for the given date (full day in UTC)
    v_start := p_date::timestamptz;
    v_end := (p_date + interval '1 day')::timestamptz;

    SELECT COALESCE(jsonb_agg(team_digest), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'owner_email', u.email,
            'team_name', t.name,
            'team_id', t.id,
            'completions', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'member_name', tc.member_name,
                        'sop_title', tc.sop_title,
                        'completed_at', tc.completed_at,
                        'completed_steps', tc.completed_steps,
                        'total_steps', tc.total_steps
                    ) ORDER BY tc.completed_at ASC
                ), '[]'::jsonb)
                FROM team_completions tc
                WHERE tc.team_id = t.id
                  AND tc.completed_at >= v_start
                  AND tc.completed_at < v_end
            )
        ) AS team_digest
        FROM teams t
        JOIN auth.users u ON u.id = t.owner_id
        WHERE
            -- Only teams that had completions on this date
            EXISTS (
                SELECT 1 FROM team_completions tc
                WHERE tc.team_id = t.id
                  AND tc.completed_at >= v_start
                  AND tc.completed_at < v_end
            )
            -- Exclude owners who opted out
            AND COALESCE((u.raw_user_meta_data->>'digest_optout')::boolean, false) = false
    ) sub;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- VERIFY (should return empty array if no completions on that date):
--   SELECT get_daily_digest_data(CURRENT_DATE);
--   SELECT get_daily_digest_data(CURRENT_DATE - interval '1 day');
-- ============================================================================
