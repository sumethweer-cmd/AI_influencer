-- RunningHub workflows the Content page can send jobs to (replaces env RUNNINGHUB_WORKFLOW_ID).
-- Additive only. RLS on with no policies: readable/writable only with the service-role key (API routes).
create table if not exists public.pipeline_render_workflows (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    provider text not null default 'runninghub' check (provider in ('runninghub')),
    workflow_id text not null,
    node_editor text not null default '26',
    node_project text not null default '17',
    is_default boolean not null default false,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create unique index if not exists pipeline_render_workflows_one_default
    on public.pipeline_render_workflows (provider) where is_default;
alter table public.pipeline_render_workflows enable row level security;
revoke all on public.pipeline_render_workflows from anon, authenticated;
