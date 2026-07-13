-- ============================================================
-- Make the PDF credit/watermark text configurable independently of
-- the body font size, and let it be positioned in any corner with
-- its own font.
-- ============================================================
INSERT INTO etsy_configs (key_name, key_value, description)
VALUES
  ('ETSY_CREDIT_POSITION', 'bottom-right', 'Corner the credit text is drawn in: top-left, top-right, bottom-left, bottom-right'),
  ('ETSY_CREDIT_SIZE', '12', 'px @ 300 DPI. Independent of body font size.'),
  ('ETSY_CREDIT_FONT_URL', '', 'Optional separate font for the credit text. Leave blank to reuse the body font.')
ON CONFLICT (key_name) DO NOTHING;
