-- Auto dispatcher for the Content page: a send queue + one settings row + a cron job that
-- exists ONLY while the dispatcher is enabled (the app schedules/unschedules it).
-- Additive only. RLS on with no policies (service-role access from API routes only).

create table if not exists public.pipeline_dispatcher_settings (
    id int primary key default 1 check (id = 1),
    enabled boolean not null default false,
    max_per_tick int not null default 3,          -- safety net per tick, NOT RunningHub's limit
    daily_limit int,                               -- optional cap of sends per day (null = no cap)
    site_url text,                                 -- origin of the deployed app, called by pg_net
    last_tick_at timestamptz,
    last_note text,
    updated_at timestamptz not null default now()
);
insert into public.pipeline_dispatcher_settings (id) values (1) on conflict do nothing;

create table if not exists public.pipeline_send_queue (
    id uuid primary key default gen_random_uuid(),
    content_item_id uuid not null references public.pipeline_content_items(id) on delete cascade,
    workflow_row_id uuid,
    status text not null default 'waiting' check (status in ('waiting', 'sent', 'failed', 'cancelled')),
    attempts int not null default 0,
    last_error text,
    task_job_id text,
    enqueued_at timestamptz not null default now(),
    sent_at timestamptz
);
create index if not exists pipeline_send_queue_status_idx on public.pipeline_send_queue (status, enqueued_at);

create table if not exists public.pipeline_dispatch_log (
    id bigserial primary key,
    at timestamptz not null default now(),
    active_before int,
    sent int,
    queue_maxed boolean not null default false,
    note text
);

alter table public.pipeline_dispatcher_settings enable row level security;
alter table public.pipeline_send_queue enable row level security;
alter table public.pipeline_dispatch_log enable row level security;
revoke all on public.pipeline_dispatcher_settings, public.pipeline_send_queue, public.pipeline_dispatch_log from anon, authenticated;

-- shared secret between pg_cron/pg_net and the app route; generated here, never printed, stored in Vault
do $$
begin
    if not exists (select 1 from vault.decrypted_secrets where name = 'pipeline_cron_secret') then
        perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'pipeline_cron_secret', 'auth for /api/pipeline/dispatch');
    end if;
end $$;

create or replace function public.pipeline_verify_cron_secret(s text) returns boolean
language sql security definer set search_path = '' as $$
    select exists (select 1 from vault.decrypted_secrets where name = 'pipeline_cron_secret' and decrypted_secret = s)
$$;

-- (un)schedules the 30-minute tick. Unscheduling also prunes old cron run history.
create or replace function public.pipeline_dispatcher_schedule(p_enabled boolean, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
begin
    perform cron.unschedule(jobid) from cron.job where jobname = 'pipeline-dispatch';
    if p_enabled then
        perform cron.schedule(
            'pipeline-dispatch',
            '*/30 * * * *',
            format(
                $c$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_cron_secret')), body := '{}'::jsonb, timeout_milliseconds := 60000)$c$,
                rtrim(p_url, '/') || '/api/pipeline/dispatch'
            )
        );
    else
        delete from cron.job_run_details where end_time < now() - interval '7 days';
    end if;
end $$;

revoke all on function public.pipeline_verify_cron_secret(text) from public, anon, authenticated;
revoke all on function public.pipeline_dispatcher_schedule(boolean, text) from public, anon, authenticated;
grant execute on function public.pipeline_verify_cron_secret(text) to service_role;
grant execute on function public.pipeline_dispatcher_schedule(boolean, text) to service_role;
