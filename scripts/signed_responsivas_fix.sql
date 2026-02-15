-- 1. Add missing columns for legal integrity if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signed_responsivas' AND column_name = 'legal_hash') THEN
        ALTER TABLE public.signed_responsivas ADD COLUMN legal_hash TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'signed_responsivas' AND column_name = 'legal_snapshot') THEN
        ALTER TABLE public.signed_responsivas ADD COLUMN legal_snapshot TEXT;
    END IF;
END $$;

-- 2. Identify and drop restrictive policies
DROP POLICY IF EXISTS "Enable full access for all" ON public.signed_responsivas;
DROP POLICY IF EXISTS "Full access" ON public.signed_responsivas;

-- 3. Ensure RLS is enabled
ALTER TABLE public.signed_responsivas ENABLE ROW LEVEL SECURITY;

-- 4. Create proper RBAC policies for Responsivas
-- Note: Requires a 'profiles' table with 'role' column as defined in user_management migration

-- Allow ALL authenticated users to SELECT (view) responsivas
CREATE POLICY "Responsivas are viewable by authenticated users" 
ON public.signed_responsivas FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow Admins and Operators to INSERT (sign/save) responsivas
CREATE POLICY "Admins and Operators can insert responsivas" 
ON public.signed_responsivas FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'operator')
    )
);

-- Allow Admins and Operators to DELETE responsivas
CREATE POLICY "Admins and Operators can delete responsivas" 
ON public.signed_responsivas FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'operator')
    )
);
