-- Content Pipeline: human-readable title per item, so the dashboard queue and
-- downloaded filenames are identifiable at a glance instead of showing only
-- character/category/mechanic or a raw UUID.

alter table public.pipeline_content_items
    add column if not exists title text;
