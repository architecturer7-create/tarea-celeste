-- Remove broad SELECT policy on avatars bucket to prevent listing.
-- Public bucket files are still accessible via getPublicUrl (direct CDN), no SELECT policy needed.
DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;