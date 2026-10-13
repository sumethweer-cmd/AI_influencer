-- 001_render_tasks.sql — APPLIED 2026-10-13 to project "Test AI Influe" (uzlpqpomtoolgpljjtmv) as migration create_render_tasks_and_render_todo
-- ledger งานเรนเดอร์วิดีโอ ใช้ได้ทั้ง RunningHub และ RunPod (บอก provider ว่าสั่งงานที่ไหน)
-- โปรเจกต์เป้าหมายที่ผมเห็นผ่าน MCP: "Test AI Influe" (uzlpqpomtoolgpljjtmv) — รอผู้ใช้ยืนยันว่าเป็นตัวที่ใช้จริง
-- ความปลอดภัย: เปิด RLS และไม่ตั้ง policy = anon/authenticated เข้าไม่ได้ มีแต่ service role (สคริปต์) เท่านั้น
-- ตารางนี้เพิ่มอย่างเดียว ไม่แก้/ไม่ลบตารางเดิม

create table if not exists public.render_tasks (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null check (provider in ('runninghub','runpod')),   -- สั่งงานที่ไหน
  job_id           text not null,                 -- RH: taskId · RunPod/ComfyUI: prompt_id
  content_item_id  uuid references public.pipeline_content_items(id) on delete set null,  -- แถวหลักของเรื่อง (segment 1)
  story_key        text,                          -- เช่น 2026-10-12/01_Gray_Hair
  project_name     text not null,                 -- project_name ใน workflow (ไม่ซ้ำต่อเรื่อง)
  workflow_id      text,                          -- RH workflowId (RunPod ว่างได้)
  pod_id           text,                          -- RunPod pod id (RH ว่าง)
  gpu              text,                          -- เช่น '4090', '5090' (ถ้ารู้)
  status           text not null default 'QUEUED'
                   check (status in ('QUEUED','RUNNING','SUCCESS','FAILED','CANCELLED')),
  submitted_at     timestamptz not null default now(),
  running_at       timestamptz,                   -- จับได้ตอนเช็กสถานะ (ความละเอียดเท่าความถี่ที่เช็ก)
  finished_at      timestamptz,
  run_seconds      integer,                       -- RH: taskCostTime · RunPod: เวลา execute จริง
  coins            integer,                       -- RH: consumeCoins
  cost_usd         numeric(10,4),                 -- ต้นทุนประมาณเป็นเงิน (RunPod = เวลา × ค่าเช่า/ชม.; RH = coins × ราคาต่อ coin)
  seed             bigint,
  segments         smallint,
  total_frames     integer,
  prompt_version   text,                          -- ชื่อ/hash ไฟล์ prompt ที่ใช้ (SEG1..N)
  file_url         text,                          -- ลิงก์ผลลัพธ์ของผู้ให้บริการ (RH ไม่ทราบอายุ → ควรดาวน์โหลดเก็บ)
  drive_file_id    text,                          -- Google Drive
  drive_url        text,
  asset_id         uuid references public.pipeline_assets(id) on delete set null,   -- ถ้าอัปโหลดเข้า pipeline_assets
  local_path       text,
  downloaded       boolean not null default false,
  error            text,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (provider, job_id)
);

create index if not exists render_tasks_status_idx on public.render_tasks (status);
create index if not exists render_tasks_content_item_idx on public.render_tasks (content_item_id);
create index if not exists render_tasks_submitted_idx on public.render_tasks (submitted_at desc);

alter table public.render_tasks enable row level security;
-- ไม่มี policy โดยตั้งใจ — เข้าถึงผ่าน service role key ในสคริปต์เท่านั้น (ห้ามใส่ใน frontend)

comment on table public.render_tasks is 'ledger งานเรนเดอร์วิดีโอ (RunningHub/RunPod): job id, สถานะ, เวลา, ต้นทุน, ไฟล์/Drive';

-- ---- เพิ่มเติม (รอบที่อนุมัติ) ----
-- กันไม่ให้ anon/authenticated แตะตารางนี้เลย (นอกเหนือจาก RLS ที่เปิดไว้ และไม่มี policy)
revoke all on public.render_tasks from anon, authenticated;

-- มุมมอง "เรื่องที่ยังไม่มีคลิป SUCCESS" = สิ่งที่ต้องเจน (แถวหลักของ pipeline_content_items ที่ยังไม่ posted และยังไม่เคยเรนเดอร์สำเร็จ)
create or replace view public.render_todo with (security_invoker = true) as
select
  p.id                                   as content_item_id,
  p.title,
  p.character,
  p.model,
  p.status                               as plan_status,
  p.scheduled_date,
  1 + (select count(*) from public.pipeline_content_items c where c.parent_content_item_id = p.id) as segments,
  lt.provider                            as last_provider,
  lt.status                              as last_render_status,
  lt.submitted_at                        as last_submitted_at,
  lt.coins                               as last_coins
from public.pipeline_content_items p
left join lateral (
  select t.provider, t.status, t.submitted_at, t.coins
  from public.render_tasks t
  where t.content_item_id = p.id
  order by t.submitted_at desc
  limit 1
) lt on true
where p.parent_content_item_id is null
  and p.status <> 'posted'
  and not exists (select 1 from public.render_tasks t2 where t2.content_item_id = p.id and t2.status = 'SUCCESS');

revoke all on public.render_todo from anon, authenticated;
comment on view public.render_todo is 'เรื่องที่ยังไม่มีผลเรนเดอร์สำเร็จ (ใช้ service role เท่านั้น)';
