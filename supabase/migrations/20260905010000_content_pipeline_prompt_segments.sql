-- Supports splitting one content item into multiple generation-length-bounded
-- prompt segments (e.g. minimax-h3 items whose total runtime exceeds ~15s get
-- split into separate compiled prompts, generated as separate clips, then
-- joined back into one final video for that content item).
--
-- A "parent" segment (segment_number = 1) is a normal pipeline_content_items
-- row. Later segments are additional rows with the same character/title/
-- core_mechanic but their own compiled_prompt/srt_content, linked back via
-- parent_content_item_id. A non-segmented item just has segment_number = 1
-- (or null) and no parent — nothing else changes for it.
alter table public.pipeline_content_items
    add column if not exists parent_content_item_id uuid references public.pipeline_content_items(id),
    add column if not exists segment_number smallint;

create index if not exists pipeline_content_items_parent_idx
    on public.pipeline_content_items(parent_content_item_id);
