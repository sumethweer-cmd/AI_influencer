-- Content Pipeline: Supabase-backed review queue for the .claude/skills content
-- pipeline (content-calendar / content-request). Separate from the legacy
-- AI Influencer tables and from the Etsy tables — this is its own project.

create table if not exists public.pipeline_content_items (
    id uuid primary key default gen_random_uuid(),

    character text not null,                  -- e.g. 'momo', 'anong'
    content_category text,                     -- content_dna category used
    core_mechanic text,
    delivery_format text,                      -- image_set | carousel | video_clip | story
    visual_format text,                        -- format_bibles name, if any
    platform text,                              -- e.g. 'tiktok', 'instagram_reels', 'shopee'
    model text,                                 -- model_specs name used (krea, minimax-h3, ...)

    character_take text,                        -- the in-character line(s), for quick reading without opening the prompt
    compiled_prompt text not null,               -- full compiled_prompt content, ready to paste into the model
    srt_content text,                            -- auto-generated .srt from H3 dialogue timestamps, null for image-only items

    validation_report jsonb,                     -- last prompt-validator output, for traceability

    status text not null default 'pending'
        check (status in ('pending', 'qc_fail', 'approved', 'posted')),
    note text,                                    -- human notes — what's missing, what to fix

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists pipeline_content_items_character_idx on public.pipeline_content_items (character);
create index if not exists pipeline_content_items_status_idx on public.pipeline_content_items (status);
create index if not exists pipeline_content_items_created_at_idx on public.pipeline_content_items (created_at desc);

-- keep updated_at current on every row update
create or replace function public.pipeline_content_items_set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pipeline_content_items_updated_at on public.pipeline_content_items;
create trigger trg_pipeline_content_items_updated_at
    before update on public.pipeline_content_items
    for each row execute function public.pipeline_content_items_set_updated_at();
