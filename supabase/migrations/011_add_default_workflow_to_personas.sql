-- ============================================================
-- Migration: Add default_workflow_id to ai_personas
-- ============================================================

ALTER TABLE ai_personas
  ADD COLUMN IF NOT EXISTS default_workflow_id UUID REFERENCES comfyui_workflows(id) ON DELETE SET NULL;
