-- SOP Tool Database Schema
-- Run this in Supabase SQL Editor

-- ============================================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Future: Payments
    subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'trial', 'active', 'cancelled', 'past_due')),
    subscription_ends_at TIMESTAMPTZ,
    stripe_customer_id TEXT,
    
    -- User preferences (synced from frontend)
    preferences JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- FOLDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    color TEXT DEFAULT '#6b7280',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SOPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    tags TEXT[] DEFAULT '{}',
    
    -- Steps stored as JSONB array
    -- Each step: { text: string, note?: string }
    steps JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CHECKLISTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    sop_id UUID REFERENCES public.sops(id) ON DELETE SET NULL,
    
    -- Snapshot of SOP at creation time (immutable)
    sop_title TEXT NOT NULL,
    sop_snapshot_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Steps with completion state
    -- Each step: { text: string, note?: string, completed: boolean, completedAt?: timestamp, userNote?: string }
    steps JSONB DEFAULT '[]'::jsonb,
    
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    completed_steps INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_sops_user_id ON public.sops(user_id);
CREATE INDEX IF NOT EXISTS idx_sops_folder_id ON public.sops(folder_id);
CREATE INDEX IF NOT EXISTS idx_sops_status ON public.sops(status);
CREATE INDEX IF NOT EXISTS idx_checklists_user_id ON public.checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_sop_id ON public.checklists(sop_id);
CREATE INDEX IF NOT EXISTS idx_checklists_status ON public.checklists(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Folders: Users can only access their own folders
CREATE POLICY "Users can view own folders" ON public.folders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own folders" ON public.folders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON public.folders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON public.folders
    FOR DELETE USING (auth.uid() = user_id);

-- SOPs: Users can only access their own SOPs
CREATE POLICY "Users can view own sops" ON public.sops
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sops" ON public.sops
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sops" ON public.sops
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sops" ON public.sops
    FOR DELETE USING (auth.uid() = user_id);

-- Checklists: Users can only access their own checklists
CREATE POLICY "Users can view own checklists" ON public.checklists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own checklists" ON public.checklists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklists" ON public.checklists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own checklists" ON public.checklists
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON public.folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sops_updated_at
    BEFORE UPDATE ON public.sops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_checklists_updated_at
    BEFORE UPDATE ON public.checklists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- SEED DATA (Optional: Default folder)
-- ============================================================================

-- Note: Default "General" folder is created client-side when needed
-- No server-side seed data required
