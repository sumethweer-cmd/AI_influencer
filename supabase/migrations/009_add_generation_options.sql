-- Migration 009: Add Generation Options (Batch Size, Width, Height)
-- This allows customizing the output dimensions and the number of images generated per prompt.

ALTER TABLE public.content_items
ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS image_width INTEGER DEFAULT 896,
ADD COLUMN IF NOT EXISTS image_height INTEGER DEFAULT 1152;
