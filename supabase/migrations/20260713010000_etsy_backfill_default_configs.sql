-- ============================================================
-- Backfill missing etsy_configs default rows.
-- The original 202603030000_etsy_project_base.sql migration was never
-- applied to the live database (tables existed, but these config rows
-- did not), so the Settings & Fonts page had nothing to render/edit
-- for layout dimensions, font, and font size.
-- ============================================================
INSERT INTO etsy_configs (key_name, key_value, description)
VALUES
  ('ETSY_PDF_WIDTH', '2550', '300 DPI Width for 8.5"'),
  ('ETSY_PDF_HEIGHT', '3300', '300 DPI Height for 11"'),
  ('ETSY_COMFY_WIDTH', '1024', 'ComfyUI Width Input'),
  ('ETSY_COMFY_HEIGHT', '1024', 'ComfyUI Height Input'),
  ('ETSY_GEMINI_STORY_PROMPT', 'You are an expert children story book author. Write a short coloring book story...', 'Prompt for Gemini Storytelling'),
  ('ETSY_GEMINI_API_KEY', '', 'Separate API Key for Etsy'),
  ('ETSY_FONT_URL', '', 'Active custom font URL used in PDF export'),
  ('ETSY_FONT_SIZE', '36', 'px @ 300 DPI. Use "auto" to let the export shrink text to fit its box.')
ON CONFLICT (key_name) DO NOTHING;
