-- ============================================================
-- Migration: Add Base Prompts to ComfyUI Workflows
-- ============================================================

ALTER TABLE comfyui_workflows 
ADD COLUMN IF NOT EXISTS base_positive_prompt TEXT DEFAULT '8k, hyper realistic, high quality, masterpiece',
ADD COLUMN IF NOT EXISTS base_negative_prompt TEXT DEFAULT 'bad anatomy, missing fingers, worst quality, low quality',
ADD COLUMN IF NOT EXISTS negative_prompt_node_id VARCHAR(50);
