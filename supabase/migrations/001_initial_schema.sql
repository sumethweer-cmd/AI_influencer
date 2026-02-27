-- ============================================================
-- Nong Kung Agency — Supabase Database Migration
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: weekly_plans
-- เก็บแผนคอนเทนต์รายสัปดาห์ที่ได้จาก Phase 1
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  raw_trends JSONB,           -- ข้อมูล Trends จาก Apify
  plan_json JSONB NOT NULL,   -- weekly_plan.json ทั้งหมด
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: content_items
-- เก็บ Content แต่ละชิ้น (21 ชิ้นต่อสัปดาห์)
-- ============================================================
CREATE TYPE content_type AS ENUM ('Post', 'Carousel', 'Story');
CREATE TYPE content_status AS ENUM (
  'Draft',
  'In Production',
  'QC Pending',
  'Awaiting Approval',
  'Scheduled',
  'Published'
);

CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_plan_id UUID REFERENCES weekly_plans(id) ON DELETE CASCADE,
  sequence_number INT NOT NULL,         -- ลำดับที่ 1-21
  content_type content_type NOT NULL,
  topic TEXT NOT NULL,
  theme TEXT,
  sfw_prompt TEXT NOT NULL,
  nsfw_option BOOLEAN DEFAULT FALSE,
  caption_draft TEXT,
  caption_final TEXT,
  status content_status DEFAULT 'Draft',
  scheduled_at TIMESTAMPTZ,             -- เวลาที่จะโพสต์
  published_at TIMESTAMPTZ,             -- เวลาที่โพสต์จริง
  post_url TEXT,                        -- URL ของโพสต์ที่โพสต์แล้ว
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: generated_images
-- เก็บรูปภาพที่ Generate จาก Phase 2 + QC Score จาก Phase 3
-- ============================================================
CREATE TYPE image_type AS ENUM ('SFW', 'NSFW');
CREATE TYPE image_status AS ENUM ('Generated', 'QC_Pass', 'QC_Fail', 'Selected', 'Rejected');

CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  image_type image_type NOT NULL,
  file_path TEXT NOT NULL,              -- Local path: /storage/images/{content_id}/SFW/
  file_name TEXT NOT NULL,
  seed BIGINT,                          -- ComfyUI Seed ที่ใช้
  workflow_json JSONB,                  -- ComfyUI Workflow ที่ใช้
  quality_score INT,                    -- 0-100 จาก Gemini Vision QC
  qc_feedback JSONB,                    -- Feedback จาก AI QC
  status image_status DEFAULT 'Generated',
  gen_attempt INT DEFAULT 1,            -- ครั้งที่ Generate (สำหรับ Re-gen Loop)
  runpod_job_id TEXT,                   -- Runpod Pod ID ที่ใช้
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: schedules
-- เก็บ Schedule การโพสต์ที่ Approve แล้ว
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  selected_image_id UUID REFERENCES generated_images(id),
  platform TEXT DEFAULT 'twitter',      -- twitter, instagram, etc.
  scheduled_at TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  post_url TEXT,
  status TEXT DEFAULT 'pending',        -- pending, posted, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: engagement_logs
-- เก็บ Engagement Data จาก Platform (Phase 5)
-- ============================================================
CREATE TABLE IF NOT EXISTS engagement_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID REFERENCES content_items(id),
  schedule_id UUID REFERENCES schedules(id),
  platform TEXT NOT NULL,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: system_logs
-- เก็บ Log การทำงานของระบบ (สำหรับ Debug และ Telegram)
-- ============================================================
CREATE TYPE log_level AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level log_level DEFAULT 'INFO',
  phase TEXT,                           -- 'Phase1', 'Phase2', etc.
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes สำหรับ Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_weekly_plan ON content_items(weekly_plan_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_content ON generated_images(content_item_id);
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_at ON schedules(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_system_logs_phase ON system_logs(phase);

-- ============================================================
-- Row Level Security (RLS) — เปิดไว้ก่อน server-side ใช้ service_role
-- ============================================================
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Allow service_role to bypass RLS (default behavior)
-- Dashboard access via authenticated session
CREATE POLICY "Allow authenticated access" ON weekly_plans FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON content_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON generated_images FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON schedules FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON engagement_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON system_logs FOR ALL TO authenticated USING (true);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weekly_plans_updated_at
  BEFORE UPDATE ON weekly_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
