-- Content Pipeline: distinguish a reference image (<Picture N> input) from
-- the finished generated output (video/image the model produced for this
-- item), both stored in pipeline_assets and both scoped to a content item.

alter table public.pipeline_assets
    add column if not exists asset_type text not null default 'reference'
        check (asset_type in ('reference', 'output'));

create index if not exists pipeline_assets_asset_type_idx on public.pipeline_assets (asset_type);
