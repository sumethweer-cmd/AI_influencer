-- Content Pipeline: let an asset (reference image) be scoped to one specific
-- content item and tagged with which <Picture N> slot it fills, so a
-- generated/reference image can be attached directly to the item it belongs
-- to and pulled up from any device — not just the character-wide library.

alter table public.pipeline_assets
    add column if not exists content_item_id uuid references public.pipeline_content_items(id) on delete set null,
    add column if not exists picture_slot smallint;

create index if not exists pipeline_assets_content_item_id_idx on public.pipeline_assets (content_item_id);
