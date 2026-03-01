-- Update content_items table for Video Cover and Platform Selections
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS video_cover_id UUID REFERENCES public.generated_images(id),
ADD COLUMN IF NOT EXISTS platform_selections JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS image_prompts JSONB DEFAULT '{}';

-- Remove audio_ref if it exists (Cleanup as requested)
ALTER TABLE public.content_items DROP COLUMN IF EXISTS audio_ref;

-- Update generated_images table for Media Hub & Video Queue
ALTER TABLE public.generated_images
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image',
ADD COLUMN IF NOT EXISTS vdo_prompt TEXT,
ADD COLUMN IF NOT EXISTS vdo_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS vdo_job_id TEXT;

-- Update schedules table for multi-image support
ALTER TABLE public.schedules
ADD COLUMN IF NOT EXISTS additional_image_ids JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'generic';

COMMENT ON COLUMN public.content_items.video_cover_id IS 'ID of the image to be used as thumbnail for the main video';
COMMENT ON COLUMN public.generated_images.vdo_prompt IS 'Specific prompt for generating video from this image variant';
COMMENT ON COLUMN public.generated_images.vdo_status IS 'Status of 1:1 video generation (none, pending, processing, completed, failed)';
