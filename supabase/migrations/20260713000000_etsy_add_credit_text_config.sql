-- ============================================================
-- Add ETSY_CREDIT_TEXT config
-- Watermark/credit text drawn bottom-right on every content page of the PDF export
-- ============================================================
INSERT INTO etsy_configs (key_name, key_value, description)
VALUES
  ('ETSY_CREDIT_TEXT', 'BuayandGuay - Coloring book', 'Credit text shown bottom-right on every content page of the PDF export. Leave blank to disable.')
ON CONFLICT (key_name) DO NOTHING;
