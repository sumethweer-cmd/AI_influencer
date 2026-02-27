-- ============================================================
-- Table: production_jobs
-- ติดตามสถานะการรัน Runpod Batch สำหรับหน้า UI Monitor
-- ============================================================
CREATE TABLE IF NOT EXISTS production_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  runpod_job_id VARCHAR(255),           -- ID ของ Runpod Pod
  status VARCHAR(100) NOT NULL,         -- Starting, Deploying Pod, Waiting for ComfyUI, Generating, Terminating Pod, Completed, Failed
  total_items INT DEFAULT 0,            -- จำนวนภาพทั้งหมดใน Batch
  completed_items INT DEFAULT 0,        -- จำนวนภาพที่สำเร็จ
  current_item_id UUID,                 -- Content Item ID ล่าสุดที่กำลังทำ
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index For Frontend Polling (หา Job ที่ยังไม่เสร็จ)
CREATE INDEX IF NOT EXISTS idx_active_production_jobs ON production_jobs(status) WHERE status NOT IN ('Completed', 'Failed');

-- RLS
ALTER TABLE production_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON production_jobs FOR ALL TO authenticated USING (true);

-- Update Trigger
CREATE TRIGGER trg_production_jobs_updated_at
  BEFORE UPDATE ON production_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
