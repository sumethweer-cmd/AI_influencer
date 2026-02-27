-- Add selected_workflow_id to content_items to allow users to override the default workflow

ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS selected_workflow_id UUID REFERENCES comfyui_workflows(id);
