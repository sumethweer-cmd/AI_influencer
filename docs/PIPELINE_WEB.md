# Content page (/dashboard/pipeline)

One page for a content's whole life: prompt (per segment, editable) -> reference pictures (library or upload) -> send to RunningHub -> status -> result link with 14-day expiry. Repair a bad segment by rendering only that segment as a standalone clip.

## Environment variables (set on Vercel / .env.local; never commit)
| Name | Needed for | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | everything | server-side reads/writes |
| `RUNNINGHUB_API_KEY` | refresh status, send | server only |
| `RUNNINGHUB_WORKFLOW_ID` | send (legacy fallback) | only used when no workflow is configured on the page; prefer the "Workflow" button (table `pipeline_render_workflows`) |
| `RH_NODE_EDITOR` | send (legacy fallback) | default `26`; per-workflow value is set on the page |
| `RH_NODE_PROJECT` | send (legacy fallback) | default `17`; per-workflow value is set on the page |
| `PIPELINE_ADMIN_TOKEN` | all write routes | if set, requests need header `x-admin-token`; the page has a password box |

## Data model
- Content = `pipeline_content_items` main row (= segment 1); segments 2..N point to it with `parent_content_item_id` + `segment_number`.
- Pictures = `pipeline_assets` rows with `content_item_id` + `picture_slot` (1..3, must be contiguous). Library = `pipeline_assets` rows with `content_item_id` null and `asset_type = 'reference'` (files under `library/` in bucket `pipeline-assets`; never deleted by the page).
- Render job = `render_tasks` row: `job_id` = RunningHub taskId, `content_item_id`, `seg_from` + `seg_count` (full job = 1..N, repair = a subset), `note` JSON (`kind: full|repair`, prompt snapshot for repairs).

## Routes
- `GET /api/pipeline/overview`, `GET /api/pipeline/library` (read)
- `PATCH /api/pipeline/segment` (save prompt), `POST /api/pipeline/slot` (set picture), `POST|PUT /api/pipeline/library` (upload to library), `PATCH /api/pipeline/task` (mark downloaded)
- `POST /api/pipeline/refresh` (asks RunningHub for status of up to 5 unfinished jobs; never spends coins)
- `POST /api/pipeline/send` (**spends coins when RunningHub runs it**; needs `confirm: true`)

## Auto dispatcher (send queue)
Select contents on the page -> "เข้าคิวส่งที่เลือก". They go into `pipeline_send_queue` (status `waiting`) and the dispatcher switches on.
- **Tick**: `pg_cron` job `pipeline-dispatch` (every 30 min) -> `pg_net` POST `/api/pipeline/dispatch` with header `x-cron-secret` (secret lives in Supabase Vault, checked via `pipeline_verify_cron_secret`; nothing to put in Vercel env).
- **Each tick** (`lib/dispatcher.ts`): refresh unfinished RunningHub tasks (free) -> send waiting contents one by one until RunningHub answers `TASK_QUEUE_MAXED` (no fixed concurrency limit is assumed), the per-tick safety limit (`max_per_tick`, default 3) or the optional `daily_limit` is hit -> if nothing is waiting and nothing is running, switch off and **remove the cron job**.
- **Safety**: a content already sent is never sent twice; an item failing 3 times is parked as `failed`; every tick is logged in `pipeline_dispatch_log` (incl. how many tasks were unfinished when the queue was full, to learn the real limit).
- **Off switch**: "ปิดตัวส่งอัตโนมัติ" on the page (unschedules the cron job). "รันตอนนี้" runs one tick by hand.
- The dispatcher can only be switched on from the deployed https site (pg_net must reach it), not localhost.

## Render settings per content (resolution, continuity)
Stored in the main row's `note` JSON (`resolution`, `continuity: {"2":"shot"|"context",...}`) via `PATCH /api/pipeline/content-settings`; the dispatcher and `/api/pipeline/send` read them, and `send` accepts overrides.
- `task_mode = ref` and `ref_image_size = max` are always sent; segment 1 is always `shot`; other segments default to `context` and can be switched to `shot` per segment or all at once (Segments tab and the send dialog).
- A context-written segment (timestamps +0.917 s) switched to `shot` gets 0.917 s subtracted from its timestamps; its opening sentence ("the shot continues…") is NOT rewritten.
- `resolution` is sent as node 26 field `resolution`. Default (nothing saved) = `720 x 1280 (9:16)`; saved value `workflow` = send nothing and keep the workflow's own value. The node's dropdown also has 16:9 options and "Custom" whose exact names are not known to the app: type them in the custom field. A wrong name is rejected by RunningHub when the task is created.
- `POST /api/pipeline/send` with `dryRun: true` builds everything and returns a preview (modes, shifted timestamps, resolution) without uploading or creating a task (no coins).
