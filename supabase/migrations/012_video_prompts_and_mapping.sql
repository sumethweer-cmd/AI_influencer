-- Add 3-part video prompts to generated_images
ALTER TABLE generated_images
ADD COLUMN vdo_prompt_1 text,
ADD COLUMN vdo_prompt_2 text,
ADD COLUMN vdo_prompt_3 text;

-- Add node mapping for the extra prompts to comfyui_workflows
ALTER TABLE comfyui_workflows
ADD COLUMN video_prompt_2_node_id text,
ADD COLUMN video_prompt_3_node_id text;
