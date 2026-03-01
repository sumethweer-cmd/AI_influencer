-- ============================================================
-- Migration: Add fields for Decoupled Prompting
-- ============================================================

-- Add trigger_word and instruction_rule to ai_personas
ALTER TABLE ai_personas
ADD COLUMN IF NOT EXISTS trigger_word TEXT,
ADD COLUMN IF NOT EXISTS instruction_rule TEXT;

-- Add prompt_structure to content_items to store the JSON structure of the prompt
ALTER TABLE content_items
ADD COLUMN IF NOT EXISTS prompt_structure JSONB;
