-- ============================================================
-- Etsy Generation Project — Supabase Database Migration
-- Separating the Etsy workflow entirely from the AI Influencer project.
-- ============================================================

-- ============================================================
-- Table: etsy_configs
-- Keeps settings specifically for Etsy (e.g. page layout, fonts, AI instructions)
-- ============================================================
CREATE TABLE IF NOT EXISTS etsy_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name TEXT UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store some default configurations
INSERT INTO etsy_configs (key_name, key_value, description)
VALUES 
  ('ETSY_PDF_WIDTH', '2550', '300 DPI Width for 8.5"'),
  ('ETSY_PDF_HEIGHT', '3300', '300 DPI Height for 11"'),
  ('ETSY_COMFY_WIDTH', '1024', 'ComfyUI Width Input'),
  ('ETSY_COMFY_HEIGHT', '1024', 'ComfyUI Height Input'),
  ('ETSY_GEMINI_STORY_PROMPT', 'You are an expert children story book author. Write a short coloring book story...', 'Prompt for Gemini Storytelling')
ON CONFLICT (key_name) DO NOTHING;

-- ============================================================
-- Table: etsy_workflows
-- Keeps ComfyUI workflows strictly for Etsy (e.g. Line art generation workflows)
-- ============================================================
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

-- ============================================================
-- Table: etsy_books
-- Parent record representing a single storybook
-- ============================================================
CREATE TYPE etsy_book_status AS ENUM ('Draft', 'Generating', 'Completed', 'Published');

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: etsy_pages
-- Represents a single page in the coloring book (Text + Image pair)
-- ============================================================
CREATE TYPE etsy_page_status AS ENUM ('Draft', 'Queued', 'Completed');

CREATE TABLE IF NOT EXISTS etsy_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES etsy_books(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  story_text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  image_url TEXT,
  status etsy_page_status DEFAULT 'Draft',
  runpod_job_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Triggers for updated_at
-- ============================================================
CREATE TRIGGER trg_etsy_configs_updated_at
  BEFORE UPDATE ON etsy_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_etsy_workflows_updated_at
  BEFORE UPDATE ON etsy_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_etsy_books_updated_at
  BEFORE UPDATE ON etsy_books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_etsy_pages_updated_at
  BEFORE UPDATE ON etsy_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Storage Bucket: etsy-assets
-- Separating the bucket specifically for etsy fonts & image generations
-- ============================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('etsy-assets', 'etsy-assets', true) 
ON CONFLICT (id) DO NOTHING;

-- Provide public access for selecting/reading from etsy-assets bucket
CREATE POLICY "Public Access" 
  ON storage.objects FOR SELECT 
  USING ( bucket_id = 'etsy-assets' );

-- Provide insert access
CREATE POLICY "Public Insert" 
  ON storage.objects FOR INSERT 
  WITH CHECK ( bucket_id = 'etsy-assets' );
  
CREATE POLICY "Public Delete"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'etsy-assets' );
