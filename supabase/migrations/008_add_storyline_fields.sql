-- Migration 008: Add Storyline and Campaign Theme support
-- These columns help track chronological content blocks and high-level campaign ideas.

ALTER TABLE public.weekly_plans
ADD COLUMN IF NOT EXISTS campaign_theme TEXT;

ALTER TABLE public.content_items
ADD COLUMN IF NOT EXISTS storyline TEXT;
