CREATE OR REPLACE FUNCTION public.random_avatar_color()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (ARRAY['#E8547A','#1DB88E','#F0A500','#6366F1','#EC4899','#14B8A6','#F97316','#8B5CF6'])[floor(random() * 8 + 1)::int];
$$;