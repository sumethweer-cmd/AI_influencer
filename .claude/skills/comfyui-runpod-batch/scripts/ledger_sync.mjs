// ledger_sync.mjs — ซิงก์รายการงานเรนเดอร์ขึ้นตาราง public.render_tasks บน Supabase (REST, ไม่มี dependency)
// ใช้ env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (จาก .env) — ไม่พิมพ์ key; ถ้าไม่มี env จะข้ามเงียบๆ (ledger ไฟล์ในเครื่องยังทำงาน)
// แถวอ้างอิงด้วย (provider, job_id) → ส่งซ้ำ = อัปเดต (upsert) · ข้อผิดพลาดการซิงก์ไม่ทำให้สคริปต์หลักล้ม
let warned = false;
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

export const syncEnabled = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// entry: รายการจาก ledger ในเครื่อง (ฟิลด์ที่ไม่มีให้เป็น undefined)
export function toRow(e) {
  const row = {
    provider: e.provider,
    job_id: String(e.taskId),
    project_name: e.project,
    status: e.status || 'QUEUED',
    submitted_at: iso(e.submittedAt),
    running_at: iso(e.runningAt),
    finished_at: iso(e.finishedAt),
    run_seconds: e.costTimeSec ?? null,
    coins: e.coins ?? null,
    cost_usd: e.costUsd ?? null,
    downloaded: Boolean(e.downloaded),
    local_path: e.files && e.files.length ? e.files.join(', ') : null,
    file_url: e.fileUrl ?? null,
    workflow_id: e.workflowId ?? null,
    pod_id: e.podId ?? null,
    gpu: e.gpu ?? null,
    seed: e.seed ?? null,
    segments: e.segments ?? null,
    total_frames: e.totalFrames ?? null,
    prompt_version: e.promptVersion ?? null,
    content_item_id: e.contentItemId ?? null,
    story_key: e.storyKey ?? null,
    seg_from: e.segFrom ?? 1,
    seg_count: e.segCount ?? null,
    error: e.error ?? null,
    note: e.note ?? null,
    updated_at: new Date().toISOString(),
  };
  // อย่าเขียนทับค่าที่มีอยู่ในฐานข้อมูลด้วย null เมื่อ entry ไม่รู้ค่านั้น
  for (const k of Object.keys(row)) if (row[k] === null || row[k] === undefined) delete row[k];
  return row;
}

export async function syncTask(entry) {
  if (!syncEnabled()) return { skipped: true };
  try {
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${base}/rest/v1/render_tasks?on_conflict=provider,job_id`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(toRow(entry)),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    return { ok: true };
  } catch (e) {
    if (!warned) { console.warn('[ledger] ซิงก์ Supabase ไม่สำเร็จ (ข้ามไป ไม่กระทบงานหลัก):', e.message); warned = true; }
    return { ok: false, error: e.message };
  }
}
