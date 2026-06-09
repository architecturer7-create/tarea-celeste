CREATE OR REPLACE FUNCTION public.random_avatar_color()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (ARRAY[
    '#E8547A','#1DB88E','#F0A500','#6366F1','#EC4899',
    '#14B8A6','#F97316','#8B5CF6','#EF4444','#3B82F6',
    '#10B981','#F59E0B','#06B6D4','#84CC16','#D946EF',
    '#F43F5E','#0EA5E9','#22C55E','#EAB308','#FB923C',
    '#64748B','#BE123C','#0369A1','#A21CAF'
  ])[floor(random() * 24 + 1)::int];
$$;

UPDATE perfiles SET color_avatar = '#E8547A' WHERE user_id = '9282aed8-2b51-4a10-b0d2-39a1c30cda0d';
UPDATE perfiles SET color_avatar = '#6366F1' WHERE user_id = 'e0ac736c-2a66-4b53-ba89-8442b7fcab27';
UPDATE perfiles SET color_avatar = '#EC4899' WHERE user_id = '251449f9-1992-4d69-90e1-d589705c7c28';
UPDATE perfiles SET color_avatar = '#14B8A6' WHERE user_id = '11706d35-83fb-4eb2-82e7-aebb249ed08b';
UPDATE perfiles SET color_avatar = '#F97316' WHERE user_id = 'ce50f018-9962-4011-8fed-c654ff166703';