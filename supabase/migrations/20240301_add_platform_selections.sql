-- Migration: Add platform_selections to content_items
-- Description: Allows selecting different images for different platforms (IG, X, Fanvue)
-- Created: 2024-03-01

ALTER TABLE IF EXISTS public.content_items 
ADD COLUMN IF NOT EXISTS platform_selections JSONB DEFAULT '{}';

-- Optional: Comment on column
COMMENT ON COLUMN public.content_items.platform_selections IS 'Stores the selected image IDs for each platform (e.g., {"instagram": "uuid", "twitter": "uuid"})';
