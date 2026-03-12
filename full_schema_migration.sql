-- ============================================================
-- AI Influencer & Etsy Coloring Books
-- 🐘 FINAL DEFINITIVE 100% COMPLETE DATABASE SCHEMA
-- Matches EXACTLY with original project (Globe vs Unrestricted)
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. CUSTOM ENUM TYPES
DO $$ BEGIN
    CREATE TYPE content_type AS ENUM ('Post', 'Carousel', 'Story');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE content_status AS ENUM (
      'Draft',
      'In Production',
      'Queued for Production',
      'QC Pending',
      'Awaiting Approval',
      'Scheduled',
      'Published'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE image_type AS ENUM ('SFW', 'NSFW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE image_status AS ENUM ('Generated', 'QC_Pass', 'QC_Fail', 'Selected', 'Rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE log_level AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE etsy_book_status AS ENUM ('Draft', 'Generating', 'Completed', 'Published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE etsy_page_status AS ENUM ('Draft', 'Queued', 'Completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. TABLES (Ordered to minimize dependency issues)

-- system_configs
CREATE TABLE IF NOT EXISTS system_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name TEXT UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  description TEXT,
  is_secret BOOLEAN DEFAULT TRUE,
  is_valid BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- weekly_plans
CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  raw_trends JSONB,
  plan_json JSONB NOT NULL,
  campaign_theme TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- comfyui_workflows
CREATE TABLE IF NOT EXISTS comfyui_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  persona VARCHAR(255),
  workflow_type VARCHAR(50) DEFAULT 'SFW',
  workflow_json JSONB NOT NULL,
  prompt_node_id VARCHAR(50) NOT NULL,
  negative_prompt_node_id VARCHAR(50),
  width_node_id VARCHAR(50),
  height_node_id VARCHAR(50),
  batch_size_node_id VARCHAR(50),
  video_image_node_id VARCHAR(50),
  video_prompt_node_id VARCHAR(50),
  video_prompt_2_node_id VARCHAR(50),
  video_prompt_3_node_id VARCHAR(50),
  output_node_id VARCHAR(50),
  base_positive_prompt TEXT DEFAULT '8k, hyper realistic, high quality, masterpiece',
  base_negative_prompt TEXT DEFAULT 'bad anatomy, missing fingers, worst quality, low quality',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ai_personas
CREATE TABLE IF NOT EXISTS ai_personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  trigger_word TEXT,
  instruction_rule TEXT,
  lora_triggers TEXT,
  role_prompt TEXT,
  persona_rules TEXT,
  sfw_critical TEXT,
  nsfw_critical TEXT,
  default_workflow_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- content_items
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_plan_id UUID,
  sequence_number INT NOT NULL,
  content_type content_type NOT NULL,
  topic TEXT NOT NULL,
  theme TEXT,
  sfw_prompt TEXT NOT NULL,
  nsfw_option BOOLEAN DEFAULT FALSE,
  caption_draft TEXT,
  caption_final TEXT,
  status content_status DEFAULT 'Draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  post_url TEXT,
  persona VARCHAR(255),
  gen_sfw BOOLEAN DEFAULT true,
  gen_nsfw BOOLEAN DEFAULT false,
  post_to_ig BOOLEAN DEFAULT true,
  post_to_x BOOLEAN DEFAULT false,
  post_to_fanvue BOOLEAN DEFAULT false,
  storyline TEXT,
  batch_size INTEGER DEFAULT 4,
  image_width INTEGER DEFAULT 896,
  image_height INTEGER DEFAULT 1152,
  prompt_structure JSONB,
  selected_workflow_id UUID,
  platform_selections JSONB DEFAULT '{}',
  video_cover_id UUID,
  selected_image_id UUID,
  vdo_prompt TEXT,
  vdo_prompt_nsfw TEXT,
  last_processed_at TIMESTAMPTZ,
  image_prompts JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- generated_images
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID,
  image_type image_type NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  seed BIGINT,
  workflow_json JSONB,
  quality_score INT,
  qc_feedback JSONB,
  status image_status DEFAULT 'Generated',
  gen_attempt INT DEFAULT 1,
  runpod_job_id TEXT,
  slot_index INTEGER, 
  vdo_prompt_1 text,
  vdo_prompt_2 text,
  vdo_prompt_3 text,
  original_path TEXT DEFAULT NULL,
  media_type TEXT DEFAULT 'image',
  vdo_prompt TEXT,
  vdo_status TEXT DEFAULT 'none',
  vdo_job_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- schedules
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  selected_image_id UUID REFERENCES generated_images(id),
  platform TEXT DEFAULT 'twitter',
  scheduled_at TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  post_url TEXT,
  status TEXT DEFAULT 'pending',
  additional_image_ids JSONB DEFAULT '[]', -- Migration support
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- engagement_logs
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

-- system_logs
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level log_level DEFAULT 'INFO',
  phase TEXT,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- production_jobs
CREATE TABLE IF NOT EXISTS production_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_item_id UUID,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Queued', 'Processing', 'Completed', 'Failed', 'Paused')),
    image_type TEXT CHECK (image_type IN ('SFW', 'NSFW')),
    slot_index INT,
    prompt_text TEXT,
    comfyui_prompt_id TEXT,
    comfyui_pod_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- etsy_configs
CREATE TABLE IF NOT EXISTS etsy_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name TEXT UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- etsy_workflows
CREATE TABLE IF NOT EXISTS etsy_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  workflow_json JSONB NOT NULL,
  base_positive_prompt TEXT,
  base_negative_prompt TEXT,
  negative_prompt_node_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- etsy_books
CREATE TABLE IF NOT EXISTS etsy_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  theme TEXT,
  target_age TEXT,
  total_pages INT DEFAULT 8,
  price NUMERIC DEFAULT 0,
  total_sales INT DEFAULT 0,
  status etsy_book_status DEFAULT 'Draft',
  posted_at TIMESTAMPTZ,
  cover_image_url TEXT,
  pdf_config JSONB DEFAULT '{"opacity": 85, "position": "center-left"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- etsy_pages
CREATE TABLE IF NOT EXISTS etsy_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID,
  page_number INT NOT NULL,
  story_text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  image_url TEXT,
  status etsy_page_status DEFAULT 'Draft',
  runpod_job_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_generated_images_content ON generated_images(content_item_id);
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_at ON schedules(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_phase ON system_logs(phase);

-- 6. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('etsy-assets', 'etsy-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('influencer-assets', 'influencer-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('content', 'content', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id IN ('etsy-assets', 'influencer-assets', 'content') );
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK ( bucket_id IN ('etsy-assets', 'influencer-assets', 'content') );
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING ( bucket_id IN ('etsy-assets', 'influencer-assets', 'content') );

-- ============================================================
-- 🐘 STEP 6.6 BRUTE FORCE CLEANUP
-- ============================================================
-- UPDATE content_items SET weekly_plan_id = NULL; (Already handled or skip import)

-- ============================================================
-- 🐘 STEP 7: FOREIGN KEY CONSTRAINTS & RLS (Match Globe Icons)
-- ============================================================

-- A) Link Tables
ALTER TABLE content_items ADD CONSTRAINT fk_ci_weekly_plan FOREIGN KEY (weekly_plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE;
ALTER TABLE content_items ADD CONSTRAINT fk_ci_workflow FOREIGN KEY (selected_workflow_id) REFERENCES comfyui_workflows(id);
ALTER TABLE content_items ADD CONSTRAINT fk_ci_video_cover FOREIGN KEY (video_cover_id) REFERENCES generated_images(id) ON DELETE SET NULL;
ALTER TABLE content_items ADD CONSTRAINT fk_ci_selected_image FOREIGN KEY (selected_image_id) REFERENCES generated_images(id) ON DELETE SET NULL;
ALTER TABLE generated_images ADD CONSTRAINT fk_gi_content_item FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE;
ALTER TABLE ai_personas ADD CONSTRAINT fk_persona_workflow FOREIGN KEY (default_workflow_id) REFERENCES comfyui_workflows(id);
ALTER TABLE production_jobs ADD CONSTRAINT fk_pj_content_item FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE;
ALTER TABLE etsy_pages ADD CONSTRAINT fk_ep_book FOREIGN KEY (book_id) REFERENCES etsy_books(id) ON DELETE CASCADE;

-- B) RLS Pattern Matching (GLOBE ICON = Enabled)
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comfyui_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;

-- C) Apply Policies
CREATE POLICY "Allow authenticated access" ON weekly_plans FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON content_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON generated_images FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON schedules FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON engagement_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON system_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON ai_personas FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON comfyui_workflows FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON system_configs FOR ALL TO authenticated USING (true);

-- 8. TRIGGERS
CREATE TRIGGER trg_ai_personas_updated_at BEFORE UPDATE ON ai_personas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_content_items_updated_at BEFORE UPDATE ON content_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_generated_images_updated_at BEFORE UPDATE ON generated_images FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_etsy_books_updated_at BEFORE UPDATE ON etsy_books FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_etsy_configs_updated_at BEFORE UPDATE ON etsy_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_etsy_workflows_updated_at BEFORE UPDATE ON etsy_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Production Worker Trigger
CREATE OR REPLACE FUNCTION trigger_production_worker()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Queued' THEN
    PERFORM net.http_post(
        url := 'https://REPLACE_WITH_YOUR_PROJECT.supabase.co/functions/v1/process-phase2-batch',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := row_to_json(NEW)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_production_worker AFTER INSERT OR UPDATE ON production_jobs FOR EACH ROW EXECUTE FUNCTION trigger_production_worker();
