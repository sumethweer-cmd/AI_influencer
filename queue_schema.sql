-- Update production_jobs to allow 'Paused' status
ALTER TABLE production_jobs DROP CONSTRAINT IF EXISTS production_jobs_status_check;
ALTER TABLE production_jobs ADD CONSTRAINT production_jobs_status_check CHECK (status IN ('Pending', 'Queued', 'Processing', 'Completed', 'Failed', 'Paused'));

-- Ensure system_configs has the auto_terminate_runpod setting
INSERT INTO system_configs (key_name, key_value, description)
VALUES ('AUTO_TERMINATE_RUNPOD', 'false', 'Automatically terminate Runpod when queue is empty')
ON CONFLICT (key_name) DO NOTHING;
