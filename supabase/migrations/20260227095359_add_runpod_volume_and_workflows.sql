-- ============================================================
-- Table: comfyui_workflows
-- เก็บโครงสร้าง JSON ของ ComfyUI Workflow สำหรับใช้ใน Phase 2
-- ============================================================
CREATE TABLE IF NOT EXISTS comfyui_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                  -- ชื่อ Workflow e.g., "Momo SFW V1"
  persona VARCHAR(255),                -- Momo, Karen, หรือ NULL (ใช้ได้หมด)
  workflow_type VARCHAR(50) DEFAULT 'SFW', -- SFW, NSFW, etc.
  workflow_json JSONB NOT NULL,        -- JSON API Format ของ ComfyUI
  prompt_node_id VARCHAR(50) NOT NULL, -- ID ของ Node ทึ่จะต้องยัด Prompt Text ใส่
  width_node_id VARCHAR(50),           -- ID สำหรับความกว้างภาพ
  height_node_id VARCHAR(50),          -- ID สำหรับความสูงภาพ
  batch_size_node_id VARCHAR(50),      -- ID สำหรับจำนวนรูปภาพต่อ 1 Batch
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_comfyui_workflows_persona ON comfyui_workflows(persona);

-- RLS
ALTER TABLE comfyui_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON comfyui_workflows FOR ALL TO authenticated USING (true);

-- Update Trigger
CREATE TRIGGER trg_comfyui_workflows_updated_at
  BEFORE UPDATE ON comfyui_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- เพิ่ม Config ตัวใหม่เข้าไปใน system_configs: RUNPOD_NETWORK_VOLUME_ID
INSERT INTO system_configs (key_name, key_value, description, is_secret) VALUES
('RUNPOD_NETWORK_VOLUME_ID', 'i7fp921vy5', '☁️ ใส่ Network Volume ID ของ Runpod เพื่อแชร์ไฟล์ Checkpoint/LoRA', false)
ON CONFLICT (key_name) DO NOTHING;
