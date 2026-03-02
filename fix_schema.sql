-- CORRECTIVE MIGRATION FOR PRODUCTION_JOBS
-- Run this in Supabase SQL Editor to ensure the specialized job queue is set up correctly.

-- 0. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Drop existing table to fix schema (Warning: deletes existing production_jobs data!)
DROP TABLE IF EXISTS production_jobs CASCADE;

-- 2. Create the correct production_jobs table for image-level granularity
CREATE TABLE production_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Queued', 'Processing', 'Completed', 'Failed')),
    image_type TEXT CHECK (image_type IN ('SFW', 'NSFW')),
    slot_index INT,
    prompt_text TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 3. Add index for performance
CREATE INDEX idx_prod_jobs_queue ON production_jobs(status, created_at) WHERE status = 'Queued';

-- 4. Enable Webhook Trigger for the Worker
-- This trigger will call the edge function whenever a job is set to 'Queued'
CREATE OR REPLACE FUNCTION trigger_production_worker()
RETURNS trigger AS $$
DECLARE
  base_url TEXT;
BEGIN
  -- Get base URL from system_configs or use default
  SELECT key_value INTO base_url FROM system_configs WHERE key_name = 'EDGE_FUNCTION_BASE_URL' LIMIT 1;
  IF base_url IS NULL THEN
    base_url := 'https://mpuoaljjopccqhiafgkq.supabase.co/functions/v1'; -- Hardcoded fallback
  END IF;

  -- Trigger when status is set to 'Queued'
  IF NEW.status = 'Queued' THEN
    PERFORM net.http_post(
        url := base_url || '/process-phase2-batch',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
            'type', 'UPDATE',
            'table', 'production_jobs',
            'record', row_to_json(NEW)
        )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach Trigger
DROP TRIGGER IF EXISTS trg_production_worker ON production_jobs;
CREATE TRIGGER trg_production_worker
AFTER INSERT OR UPDATE ON production_jobs
FOR EACH ROW
EXECUTE FUNCTION trigger_production_worker();
