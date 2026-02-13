-- NEXA Migration: User Management & RBAC (Refactored)
-- Timestamp: 2024-02-13

---------------------------------------------------------
-- 1. TYPES & ENUMS
---------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

---------------------------------------------------------
-- 2. TABLES & SCHEMA
---------------------------------------------------------

-- PROFILES: Extends auth.users with roles and metadata
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    role public.app_role DEFAULT 'viewer' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure 'email' column exists if the table was already there (defensive)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT UNIQUE;
    END IF;
END $$;

---------------------------------------------------------
-- 3. FUNCTIONS & TRIGGERS
---------------------------------------------------------

-- Automatically create a profile for every new user signed up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'viewer'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

---------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
---------------------------------------------------------

-- A. PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" 
    ON public.profiles FOR SELECT 
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
    ON public.profiles FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- B. PERSONNEL
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Personnel viewable by everyone" ON public.personnel;
CREATE POLICY "Personnel viewable by everyone" 
    ON public.personnel FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and Operators can manage personnel" ON public.personnel;
CREATE POLICY "Admins and Operators can manage personnel" 
    ON public.personnel FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

-- C. CARDS
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cards viewable by everyone" ON public.cards;
CREATE POLICY "Cards viewable by everyone" 
    ON public.cards FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and Operators can manage cards" ON public.cards;
CREATE POLICY "Admins and Operators can manage cards" 
    ON public.cards FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

-- D. TICKETS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tickets viewable by everyone" ON public.tickets;
CREATE POLICY "Tickets viewable by everyone" 
    ON public.tickets FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Everyone can insert tickets" ON public.tickets;
CREATE POLICY "Everyone can insert tickets" 
    ON public.tickets FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Operators can update tickets except completion" ON public.tickets;
CREATE POLICY "Operators can update tickets except completion" 
    ON public.tickets FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')))
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' 
        OR (status IS DISTINCT FROM 'completed')
    );

DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;
CREATE POLICY "Admins can delete tickets" 
    ON public.tickets FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- E. HISTORY & LOGS
ALTER TABLE public.history_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "History viewable by everyone" ON public.history_logs;
CREATE POLICY "History viewable by everyone" 
    ON public.history_logs FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and Operators can insert history" ON public.history_logs;
CREATE POLICY "Admins and Operators can insert history" 
    ON public.history_logs FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')));

-- F. CATALOGS (Buildings, Dependencies, Schedules, Special Accesses)
-- Buildings
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Buildings viewable by everyone" ON public.buildings;
CREATE POLICY "Buildings viewable by everyone" ON public.buildings FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage buildings" ON public.buildings;
CREATE POLICY "Admins can manage buildings" ON public.buildings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Dependencies
ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dependencies viewable by everyone" ON public.dependencies;
CREATE POLICY "Dependencies viewable by everyone" ON public.dependencies FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage dependencies" ON public.dependencies;
CREATE POLICY "Admins can manage dependencies" ON public.dependencies FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schedules viewable by everyone" ON public.schedules;
CREATE POLICY "Schedules viewable by everyone" ON public.schedules FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage schedules" ON public.schedules;
CREATE POLICY "Admins can manage schedules" ON public.schedules FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Special Accesses
ALTER TABLE public.special_accesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Special accesses viewable by everyone" ON public.special_accesses;
CREATE POLICY "Special accesses viewable by everyone" ON public.special_accesses FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage special accesses" ON public.special_accesses;
CREATE POLICY "Special accesses viewable by everyone" ON public.special_accesses FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage special accesses" ON public.special_accesses;
CREATE POLICY "Admins can manage special accesses" ON public.special_accesses FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
