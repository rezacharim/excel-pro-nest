-- =====================================================================
-- Excel Pro - Round 11: a photo on each announcement
-- Paste into the Supabase SQL editor and Run. Safe to run more than once.
-- Adds one column. Creates nothing, deletes nothing.
-- =====================================================================

-- Round 11 — a photo per announcement
-- Chosen from the Gallery (or uploaded straight into it) rather than typed as
-- a URL, so the news cards on the homepage can show a real picture.
ALTER TABLE "announcement" ADD COLUMN IF NOT EXISTS "imageUrl" text NULL;
