-- ============================================================
-- PHASE 4D: TEAM ACCESS — Supabase Table Setup
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. TEAMS TABLE
-- One team per owner. Created automatically when owner first invites someone.
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'My Team',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(owner_id)  -- one team per owner
);

-- 2. TEAM MEMBERS TABLE
-- Tracks invites (pending) and active members.
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- null until they sign up
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    invite_code TEXT UNIQUE NOT NULL,
    invited_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast invite code lookups
CREATE INDEX IF NOT EXISTS idx_team_members_invite_code ON team_members(invite_code);
-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES — TEAMS

-- Owners can see their own team
CREATE POLICY "teams_select_owner" ON teams
    FOR SELECT USING (owner_id = auth.uid());

-- Members can see teams they belong to
CREATE POLICY "teams_select_member" ON teams
    FOR SELECT USING (
        id IN (
            SELECT team_id FROM team_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Only the authenticated user can create their own team
CREATE POLICY "teams_insert" ON teams
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Only owner can update their team
CREATE POLICY "teams_update" ON teams
    FOR UPDATE USING (owner_id = auth.uid());

-- Only owner can delete their team
CREATE POLICY "teams_delete" ON teams
    FOR DELETE USING (owner_id = auth.uid());

-- 5. RLS POLICIES — TEAM MEMBERS

-- Owner can see all members of their team
CREATE POLICY "team_members_select_owner" ON team_members
    FOR SELECT USING (
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    );

-- Members can see their own membership
CREATE POLICY "team_members_select_self" ON team_members
    FOR SELECT USING (user_id = auth.uid());

-- Owner can insert members into their team
CREATE POLICY "team_members_insert" ON team_members
    FOR INSERT WITH CHECK (
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    );

-- Owner can update members (e.g., status changes)
CREATE POLICY "team_members_update_owner" ON team_members
    FOR UPDATE USING (
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    );

-- Members can update their own record (for accepting invites)
CREATE POLICY "team_members_update_self" ON team_members
    FOR UPDATE USING (
        invite_code IS NOT NULL AND status = 'pending'
    );

-- Owner can remove members
CREATE POLICY "team_members_delete" ON team_members
    FOR DELETE USING (
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    );

-- 6. ALLOW TEAM MEMBERS TO READ OWNER'S ACTIVE SOPs
-- This adds a new SELECT policy to the existing sops table.
-- Team members can read SOPs where the SOP owner is also their team owner AND status is active.

CREATE POLICY "sops_select_team_member" ON sops
    FOR SELECT USING (
        user_id IN (
            SELECT t.owner_id 
            FROM teams t
            JOIN team_members tm ON tm.team_id = t.id
            WHERE tm.user_id = auth.uid() 
            AND tm.status = 'active'
        )
        AND status = 'active'
    );

-- 7. FUNCTION: Accept invite (lookup by code, set user_id + status)
-- This is a server-side function so the accepting user can update a row
-- they don't own yet (user_id is null at invite time).
CREATE OR REPLACE FUNCTION accept_invite(code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    member_row team_members%ROWTYPE;
    team_row teams%ROWTYPE;
BEGIN
    -- Find the invite
    SELECT * INTO member_row FROM team_members WHERE invite_code = code;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invalid invite code');
    END IF;
    
    IF member_row.status = 'active' THEN
        RETURN json_build_object('success', false, 'error', 'Invite already used');
    END IF;
    
    -- Check if user is already a member of this team
    IF EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = member_row.team_id 
        AND user_id = auth.uid() 
        AND status = 'active'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Already a team member');
    END IF;
    
    -- Accept the invite
    UPDATE team_members 
    SET user_id = auth.uid(), status = 'active'
    WHERE id = member_row.id;
    
    -- Get team info for response
    SELECT * INTO team_row FROM teams WHERE id = member_row.team_id;
    
    RETURN json_build_object(
        'success', true, 
        'team_name', team_row.name,
        'team_id', team_row.id
    );
END;
$$;
