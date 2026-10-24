alter table public.pipeline_render_workflows
    add column if not exists prompt_prefix text not null default '';
