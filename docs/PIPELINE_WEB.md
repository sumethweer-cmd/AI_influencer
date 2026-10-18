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
