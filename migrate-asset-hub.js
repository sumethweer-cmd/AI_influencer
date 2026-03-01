const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Update content_items table for Video Cover and Platform Selections
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS video_cover_id UUID REFERENCES public.generated_images(id),
ADD COLUMN IF NOT EXISTS platform_selections JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS image_prompts JSONB DEFAULT '{}';

-- Remove audio_ref if it exists (Cleanup)
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

-- Add video node mapping columns to comfyui_workflows
ALTER TABLE public.comfyui_workflows
ADD COLUMN IF NOT EXISTS video_image_node_id TEXT,
ADD COLUMN IF NOT EXISTS video_prompt_node_id TEXT;

COMMENT ON COLUMN public.content_items.video_cover_id IS 'ID of the image to be used as thumbnail for the main video';
COMMENT ON COLUMN public.generated_images.vdo_prompt IS 'Specific prompt for generating video from this image variant';
COMMENT ON COLUMN public.generated_images.vdo_status IS 'Status of 1:1 video generation (none, pending, processing, completed, failed)';
`;

async function migrate() {
    console.log('Running migration with execute_sql (query)...');
    const { data, error } = await supabaseAdmin.rpc('execute_sql', { query: sql });

    if (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }

    console.log('Migration successful:', data);
}

migrate();
