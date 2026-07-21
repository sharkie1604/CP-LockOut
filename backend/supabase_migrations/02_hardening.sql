-- 1. Create a function to handle new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, handle, created_at, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)),
    new.created_at,
    'free'
  );
  RETURN new;
END;
$$;

-- 2. Bind the trigger to auth.users AFTER INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Add disconnected_at column to matches
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMP WITH TIME ZONE;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- 5. Create restrictive SELECT-only policies for frontend clients
-- The Express backend (using service_role key) bypasses these to handle writes
DROP POLICY IF EXISTS "Allow authenticated read users" ON public.users;
CREATE POLICY "Allow authenticated read users" 
ON public.users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read matches" ON public.matches;
CREATE POLICY "Allow authenticated read matches" 
ON public.matches FOR SELECT TO authenticated USING (true);
