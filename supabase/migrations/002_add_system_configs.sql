-- ============================================================
-- Table: system_configs
-- เก็บค่า API Keys และ Configuration ต่างๆ แบบ Dynamic
-- ============================================================
CREATE TABLE IF NOT EXISTS system_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name TEXT UNIQUE NOT NULL,       -- เช่น GEMINI_API_KEY
  key_value TEXT NOT NULL,             -- ค่าของ Key
  description TEXT,                    -- คำแนะนำการใช้งาน
  is_secret BOOLEAN DEFAULT TRUE,      -- ถ้า True จะไม่แสดงค่าใน UI ตรงๆ
  is_valid BOOLEAN DEFAULT FALSE,      -- สถานะการตรวจสอบ (Test Connection)
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_system_configs_key_name ON system_configs(key_name);

-- RLS
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON system_configs FOR ALL TO authenticated USING (true);

-- Update Trigger
CREATE TRIGGER trg_system_configs_updated_at
  BEFORE UPDATE ON system_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Initial Guides Data
INSERT INTO system_configs (key_name, key_value, description, is_secret) VALUES
('GEMINI_API_KEY', '', '🔑 ไปที่ Google AI Studio (aistudio.google.com) > Create API Key > Copy มาวางที่นี่ (ใช้สำหรับวิเคราะห์เทรนด์และ QC)', true),
('APIFY_API_TOKEN', '', '🌐 ไปที่ Apify Console > Settings > Integrations > Copy API Token (ใช้สำหรับขูดข้อมูลเทรนด์)', true),
('RUNPOD_API_KEY', '', '☁️ ไปที่ Runpod Console > Settings > API Keys > Create New Key (ใช้สำหรับเปิดเครื่อง GPU เจนรูป)', true),
('RUNPOD_TEMPLATE_ID', '', '📋 ใส่ Template ID ของ ComfyUI (ถ้าไม่มีจะใช้ค่าเริ่มต้นให้)', false),
('TELEGRAM_BOT_TOKEN', '', '🤖 ทัก @BotFather ใน Telegram > /newbot > Copy HTTP API Token ที่ได้มาวางที่นี่', true),
('TELEGRAM_CHAT_ID', '', '👤 ทัก @userinfobot ใน Telegram เพื่อดู Chat ID ของคุณและนำมาวางที่นี่ (เพื่อให้ Bot ส่งงานหาคุณได้)', false),
('TWITTER_API_V2_KEYS', '', '𝕏 ไปที่ developer.x.com > Projects & Apps > Keys and Tokens > Gen Consumer Keys & Access Tokens (ใช้สำหรับโพสต์งานอัตโนมัติ)', true)
ON CONFLICT (key_name) DO NOTHING;
