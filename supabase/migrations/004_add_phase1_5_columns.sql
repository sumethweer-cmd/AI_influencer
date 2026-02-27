-- Add Phase 1.5 Planner flags to content_items
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS gen_sfw BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gen_nsfw BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS post_to_ig BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS post_to_x BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS post_to_fanvue BOOLEAN DEFAULT false;
