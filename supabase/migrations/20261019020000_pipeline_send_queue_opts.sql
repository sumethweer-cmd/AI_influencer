alter table public.pipeline_send_queue add column if not exists opts jsonb;
comment on column public.pipeline_send_queue.opts is 'null = send the whole content; otherwise {segFrom,segCount,prompt,unshift,resolution,continuity,force} for repairs / re-renders';
