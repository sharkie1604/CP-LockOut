-- Fix public.handle_new_user() trigger to allow NULL handles during registration.
-- This avoids unique constraint collisions on email prefixes when raw_user_meta_data does not contain a handle.
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
    new.raw_user_meta_data->>'handle', -- Can be NULL/placeholder, set during onboarding
    new.created_at,
    'free'
  );
  RETURN new;
END;
$$;
