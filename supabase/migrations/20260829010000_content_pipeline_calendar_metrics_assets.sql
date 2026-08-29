-- Content Pipeline: calendar scheduling, post-performance follow-up fields,
-- and a general asset library (reference photos etc.) for pipeline_content_items.

alter table public.pipeline_content_items
    add column if not exists scheduled_date date,
    add column if not exists posted_at timestamptz,
    add column if not exists views integer,
    add column if not exists retention_pct numeric(5,2),
    add column if not exists likes integer,
    add column if not exists comments_count integer,
    add column if not exists shares integer,
    add column if not exists rating smallint check (rating is null or (rating between 1 and 5)),
    add column if not exists follow_up_notes text;

create index if not exists pipeline_content_items_scheduled_date_idx
    on public.pipeline_content_items (scheduled_date);

-- General asset library: reference photos etc. uploaded from the dashboard so
-- they're available from any machine, independent of any one content item.
create table if not exists public.pipeline_assets (
    id uuid primary key default gen_random_uuid(),

    character text,                 -- 'momo' | 'anong' | null for shared/general assets
    label text,                      -- short human label, e.g. "Momo bedroom ref"
    storage_path text not null,      -- GCS object path
    url text not null,               -- public URL
    content_type text,
    size_bytes bigint,

    created_at timestamptz not null default now()
);

create index if not exists pipeline_assets_character_idx on public.pipeline_assets (character);
create index if not exists pipeline_assets_created_at_idx on public.pipeline_assets (created_at desc);
