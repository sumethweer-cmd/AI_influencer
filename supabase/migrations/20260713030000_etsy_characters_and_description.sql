-- ============================================================
-- Character Library — reusable characters (name + appearance) that get
-- injected into the story-generation prompt so illustrations stay
-- consistent across a book/series.
-- Also adds fields needed for the Etsy description generator.
-- ============================================================
CREATE TABLE IF NOT EXISTS etsy_characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  species TEXT,
  appearance TEXT,
  personality TEXT,
  reference_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_etsy_characters_updated_at
  BEFORE UPDATE ON etsy_characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE etsy_books ADD COLUMN IF NOT EXISTS character_ids UUID[] DEFAULT '{}';
ALTER TABLE etsy_books ADD COLUMN IF NOT EXISTS learning_goal TEXT;
ALTER TABLE etsy_books ADD COLUMN IF NOT EXISTS occasion TEXT[] DEFAULT '{}';
ALTER TABLE etsy_books ADD COLUMN IF NOT EXISTS etsy_description TEXT;
