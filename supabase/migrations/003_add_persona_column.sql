-- Add persona column to content_items
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS persona VARCHAR(255);
