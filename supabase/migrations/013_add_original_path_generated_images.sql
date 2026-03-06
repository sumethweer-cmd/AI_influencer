-- Migration: Add original_path to generated_images
-- Stores reference to original PNG file on RunPod Network Volume

ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS original_path TEXT DEFAULT NULL;

COMMENT ON COLUMN generated_images.original_path IS 
'Path of original PNG on RunPod Network Volume, e.g. /workspace/ComfyUI/output/filename.png. Supabase stores WebP thumbnail only.';
