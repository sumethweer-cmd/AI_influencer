-- Two render lanes (RunningHub runs 2 tasks at once) + ETA-driven dispatcher ticks.
--  * render_tasks.lane: which lane (1/2) a task occupies
--  * pipeline_dispatcher_settings.lanes: how many lanes (default 2), next_tick_at: when the next tick is due
--  * cron fires every minute but only calls the app when next_tick_at is due (cheap SQL check)
--  * pipeline_render_workflows.megapixel_mode: node 26 uses aspect_ratio + megapixels instead of a size list
alter table public.render_tasks add column if not exists lane smallint;
alter table public.pipeline_dispatcher_settings add column if not exists lanes int not null default 2;
alter table public.pipeline_dispatcher_settings add column if not exists next_tick_at timestamptz;
alter table public.pipeline_render_workflows add column if not exists megapixel_mode boolean not null default false;

create or replace function public.pipeline_dispatch_if_due(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
    select enabled, next_tick_at into s from public.pipeline_dispatcher_settings where id = 1;
    if s.enabled is not true then return; end if;
    if s.next_tick_at is not null and s.next_tick_at > now() then return; end if;
    -- push the next check out first so a slow/failed call is retried in ~2 minutes, not every minute
    update public.pipeline_dispatcher_settings set next_tick_at = now() + interval '2 minutes' where id = 1;
    perform net.http_post(
        url := p_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_cron_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
end $$;

create or replace function public.pipeline_dispatcher_schedule(p_enabled boolean, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
begin
    perform cron.unschedule(jobid) from cron.job where jobname = 'pipeline-dispatch';
    if p_enabled then
        update public.pipeline_dispatcher_settings set next_tick_at = null where id = 1;
        perform cron.schedule(
            'pipeline-dispatch',
            '* * * * *',
            format($c$select public.pipeline_dispatch_if_due(%L)$c$, rtrim(p_url, '/') || '/api/pipeline/dispatch')
        );
    else
        delete from cron.job_run_details where end_time < now() - interval '7 days';
    end if;
end $$;

revoke all on function public.pipeline_dispatch_if_due(text) from public, anon, authenticated;
revoke all on function public.pipeline_dispatcher_schedule(boolean, text) from public, anon, authenticated;
grant execute on function public.pipeline_dispatcher_schedule(boolean, text) to service_role;
