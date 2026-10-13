#!/usr/bin/env node
// runpod_render.mjs — สั่งงาน workflow "Motion Context V2" บน ComfyUI ที่รันบน RunPod pod (ใช้เครดิต RunPod เก่า)
// ใช้ config รูปแบบเดียวกับ RunningHub (segments/prompt/frames/images/projectName) + บล็อก "runpod" (template กราฟ API, gpu, ค่าเช่า/ชม.)
// ต้องมี pod ที่เปิดอยู่และ ComfyUI พร้อมใช้ — ผู้ใช้ให้ URL ของ pod ทุกครั้ง (--pod-url) หรือ --pod auto (หา pod ที่ RUNNING ผ่าน RunPod API ด้วย RUNPOD_API_KEY)
//   node runpod_render.mjs --config a.json[,b.json] --pod-url https://<id>-8188.proxy.runpod.net            # DRY-RUN (ค่าเริ่มต้น)
//   node runpod_render.mjs --config a.json[,b.json] --pod-url ... --go [--nowait] [--poll 30]              # ส่งงาน (ใช้เวลา GPU/เครดิต)
//   node runpod_render.mjs --status --pod-url ...     # เช็กสถานะงาน RunPod ที่ค้างใน ledger (ต้องเปิด pod อยู่)
//   node runpod_render.mjs --collect --pod-url ...    # โหลดคลิปที่เสร็จแล้ว + บันทึกเวลา/ต้นทุน
// สถานะ: เขียนตามโครง ComfyUI API มาตรฐาน (/upload/image, /prompt, /history, /queue, /view) — ยังไม่เคยรันกับ pod จริง
//   รูปแบบ output ของโหนด easy saveVideo ใน /history ยังไม่รู้ → หาไฟล์ด้วยการค้นหาทั่วไป และบันทึก history ดิบทุกครั้งไว้ตรวจ
// ไม่เก็บ/พิมพ์ key · ledger ใช้ไฟล์เดียวกับ RunningHub (rh_tasks.json, แยกด้วย provider) และซิงก์ขึ้น Supabase render_tasks ถ้ามี env
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { syncTask } from './ledger_sync.mjs';

const argv = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => {
  if (x.startsWith('--')) a.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return a;
}, []));
const die = (m) => { console.error('ERROR:', m); process.exit(1); };
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const quit = async (code = 0) => { await sleep(150); process.exit(code); };
const POLL_MS = Math.max(5, Number(argv.poll) || 30) * 1000;
const uuid = () => crypto.randomUUID();
const configs = argv.config ? String(argv.config).split(',').map((s) => path.resolve(s.trim())).filter(Boolean) : [];
const mode = argv.status ? 'status' : argv.collect ? 'collect' : 'run';
if (mode === 'run' && !configs.length) die('ต้องระบุ --config a.json[,b.json] (หรือ --status / --collect)');

// ---------- .env ----------
function loadEnv() {
  let file = argv.env ? path.resolve(argv.env) : null;
  if (!file) { let d = configs[0] ? path.dirname(configs[0]) : process.cwd(); for (let i = 0; i < 6; i++) { const f = path.join(d, '.env'); if (fs.existsSync(f)) { file = f; break; } const up = path.dirname(d); if (up === d) break; d = up; } }
  if (!file || !fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue;
    const v = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
  return file;
}
const envFile = loadEnv();
const ledgerPath = argv.ledger ? path.resolve(argv.ledger) : path.join(envFile ? path.dirname(envFile) : (configs[0] ? path.dirname(configs[0]) : process.cwd()), 'rh_tasks.json');
const readLedger = () => (fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : []);
const writeLedger = (l) => fs.writeFileSync(ledgerPath, JSON.stringify(l, null, 2));
const fmt = (ms) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const FINAL = new Set(['SUCCESS', 'FAILED']);

// ---------- URL ของ pod ----------
async function resolvePod() {
  let u = String(argv['pod-url'] || process.env.RUNPOD_COMFY_URL || '').replace(/#.*$/, '').replace(/\/+$/, '');
  if (argv.pod === 'auto' || (!u && argv.pod)) {
    if (!process.env.RUNPOD_API_KEY) die('--pod auto ต้องมี RUNPOD_API_KEY ใน .env');
    const r = await fetch('https://rest.runpod.io/v1/pods', { headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` } });
    if (!r.ok) die(`ถาม RunPod ไม่สำเร็จ HTTP ${r.status}`);
    const pods = (await r.json()).filter((p) => p.desiredStatus === 'RUNNING');
    if (pods.length !== 1) die(`พบ pod ที่ RUNNING ${pods.length} ตัว ${pods.map((p) => p.id + ' ' + (p.name || '')).join(' | ')} — ระบุเองด้วย --pod-url`);
    u = `https://${pods[0].id}-8188.proxy.runpod.net`;
    console.log('ใช้ pod', pods[0].id, pods[0].name || '');
  }
  if (!/^https?:\/\//.test(u)) die('ต้องระบุ --pod-url https://<pod-id>-8188.proxy.runpod.net (หรือ --pod auto)');
  return u;
}
const podIdOf = (u) => (String(u).match(/^https?:\/\/([a-z0-9]+)-\d+\.proxy\.runpod\.net/i) || [])[1];
const get = async (pod, p) => { const r = await fetch(pod + p); if (!r.ok) throw new Error(`${p} → HTTP ${r.status}${r.status === 404 || r.status === 502 ? ' (pod หยุด/ยังไม่พร้อม หรือ URL ผิด)' : ''}`); return r; };

// ---------- track_data (รูปแบบเดียวกับ RunningHub; ตรวจแล้วว่าโครงเหมือนกัน) ----------
function buildTrackData(cfg, rel, imageNames) {
  const marker = cfg.promptStart || 'subject_definitions:';
  const readPrompt = (f) => { const raw = fs.readFileSync(rel(f), 'utf8').replace(/\r\n/g, '\n'); const i = raw.indexOf(marker); if (i < 0) die('ไม่พบ ' + marker + ' ใน ' + f); return raw.slice(i).trim() + '\n'; };
  let start = 0;
  const segs = cfg.segments.map((s, i) => { const seg = { id: uuid(), start_frame: start, end_frame: start + s.frames, color: 'var(--multitrack-task-bg)', content: { media_type: 'none', task_mode: 'ref', continuity_mode: i === 0 ? 'shot' : 'context', ref_image_size: 'max', images: imageNames.map((n) => ({ id: uuid(), source_type: 'input', file_path: n, file_name: n })), muted: false, volume_db: 0, user_prompt: readPrompt(s.prompt) } }; start += s.frames; return seg; });
  return JSON.stringify({ muted: false, volume_db: 0, task_markers: [], task_overview: false, tracks: [
    { id: uuid(), name: 'Task 0', type: 'task', task_mode: 'default', color: 'var(--multitrack-task-bg)', muted: false, solo: false, volume_db: 0, locked: false, segments: segs },
    { id: uuid(), name: 'Video 0', type: 'video', color: 'var(--primary)', muted: false, solo: false, volume_db: 0, locked: false, segments: [], audio_locked: false } ], total_length: start, frame_rate: 24 });
}

// ---------- ส่งงาน 1 config ----------
async function submitOne(cfgPath, pod) {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); const rel = (p) => path.resolve(path.dirname(cfgPath), p);
  const rp = cfg.runpod || {}; if (!rp.template) die(`config ${path.basename(cfgPath)} ไม่มีบล็อก "runpod": { "template": "<ไฟล์กราฟ API จาก RunPod>" }`);
  const tplPath = rel(rp.template); if (!fs.existsSync(tplPath)) die('ไม่พบ template ' + tplPath);
  const imgs = cfg.images.map(rel); for (const p of imgs) if (!fs.existsSync(p)) die('ไม่พบรูป ' + p);
  const nodes = cfg.nodes; const seed = Math.floor(Math.random() * 2 ** 48);
  const graphFor = (names) => { const g = JSON.parse(fs.readFileSync(tplPath, 'utf8')); if (!g[nodes.editor] || !g[nodes.project]) die(`template ไม่มีโหนด ${nodes.editor}/${nodes.project}`); g[nodes.editor].inputs.track_data = buildTrackData(cfg, rel, names); if (cfg.steps && g[nodes.steps || '22']) g[nodes.steps || '22'].inputs.steps = cfg.steps; if (cfg.megapixels) g[nodes.editor].inputs['resolution.megapixels'] = cfg.megapixels; g[nodes.project].inputs.project_name = cfg.projectName; g[nodes.project].inputs.seed = seed; return g; };
  if (!argv.go) {
    const td = JSON.parse(graphFor(imgs.map((p) => '<' + path.basename(p) + '>'))[nodes.editor].inputs.track_data); const segs = td.tracks[0].segments;
    console.log(`DRY  ${cfg.projectName}: ${segs.length} seg, ${(td.total_length / 24).toFixed(1)}s, รูป ${imgs.map((p) => path.basename(p)).join('+')}, บทไทย ${segs.reduce((n, s) => n + (s.content.user_prompt.match(/<d>\[Thai\]/g) || []).length, 0)} ประโยค, template ${path.basename(tplPath)} (${Object.keys(graphFor(imgs)).length} โหนด)`);
    return null;
  }
  const names = [];
  for (const p of imgs) {
    const buf = fs.readFileSync(p); const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const fd = new FormData(); fd.append('image', new Blob([buf], { type: 'image/png' }), `${hash}.png`); fd.append('type', 'input'); fd.append('overwrite', 'true');
    const r = await fetch(pod + '/upload/image', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.name) die(`อัปโหลดรูปไม่ผ่าน ${path.basename(p)}: HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    names.push(`${j.subfolder ? j.subfolder + '/' : ''}${j.name}`);
  }
  const r = await fetch(pod + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graphFor(names), client_id: uuid() }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.prompt_id) die(`ส่งงานไม่ผ่าน HTTP ${r.status}: ${JSON.stringify(j).slice(0, 900)}`);
  const entry = { provider: 'runpod', taskId: j.prompt_id, project: cfg.projectName, config: cfgPath, outDir: rel(rp.outDir || 'rp_outputs'), submittedAt: Date.now(), status: 'QUEUED', downloaded: false,
    podUrl: pod, podId: podIdOf(pod), gpu: rp.gpu, hourlyUsd: rp.hourlyUsd, seed, segments: cfg.segments.length, totalFrames: cfg.segments.reduce((n, s) => n + s.frames, 0),
    promptVersion: cfg.segments.map((s) => path.basename(s.prompt)).join(' + '), contentItemId: cfg.contentItemId, storyKey: cfg.storyKey, segFrom: cfg.segFrom, segCount: cfg.segCount };
  const led = readLedger(); led.push(entry); writeLedger(led); await syncTask(entry);
  console.log(`ส่งแล้ว  ${cfg.projectName}  prompt_id=${entry.taskId}  node_errors=${JSON.stringify(j.node_errors || {}).slice(0, 100)}`);
  return entry;
}

// ---------- สถานะ / เก็บผล ----------
async function refresh(e, pod) {
  if (FINAL.has(e.status) && e.finishedAt) return;
  const h = await (await get(pod, `/history/${e.taskId}`)).json(); const it = h[e.taskId]; let st = e.status;
  if (it) {
    const s = it.status || {}; st = s.status_str === 'error' ? 'FAILED' : (s.completed || s.status_str === 'success') ? 'SUCCESS' : 'RUNNING';
    const ts = (n) => (s.messages || []).find((m) => m[0] === n)?.[1]?.timestamp;
    if (ts('execution_start') && !e.runningAt) e.runningAt = ts('execution_start');
    if (FINAL.has(st)) { e.finishedAt = e.finishedAt || ts('execution_success') || ts('execution_error') || Date.now(); if (ts('execution_start') && (ts('execution_success') || ts('execution_error'))) e.costTimeSec = Math.round(((ts('execution_success') || ts('execution_error')) - ts('execution_start')) / 1000); if (e.costTimeSec != null && e.hourlyUsd) e.costUsd = Number((e.costTimeSec / 3600 * e.hourlyUsd).toFixed(4)); }
    if (st === 'FAILED') e.error = JSON.stringify((s.messages || []).filter((m) => m[0] === 'execution_error')).slice(0, 600);
  } else {
    const q = await (await get(pod, '/queue')).json();
    const inList = (arr) => (arr || []).some((x) => Array.isArray(x) && x[1] === e.taskId);
    st = inList(q.queue_running) ? 'RUNNING' : inList(q.queue_pending) ? 'QUEUED' : e.status;
    if (st === 'RUNNING' && !e.runningAt) e.runningAt = Date.now();
  }
  if (st !== e.status) { e.status = st; await syncTask(e); } else e.status = st;
}
const findFiles = (o, acc = []) => { if (Array.isArray(o)) o.forEach((x) => findFiles(x, acc)); else if (o && typeof o === 'object') { if (typeof o.filename === 'string' && /\.(mp4|mov|webm|mp3|wav)$/i.test(o.filename)) acc.push(o); Object.values(o).forEach((v) => findFiles(v, acc)); } return acc; };
async function collect(e, pod) {
  const h = await (await get(pod, `/history/${e.taskId}`)).json(); const it = h[e.taskId]; fs.mkdirSync(e.outDir, { recursive: true });
  fs.writeFileSync(path.join(e.outDir, `history_${e.taskId}.json`), JSON.stringify(it?.outputs ?? h, null, 2));
  const files = findFiles(it?.outputs || {}); e.files = [];
  for (const f of files) {
    const q = new URLSearchParams({ filename: f.filename, subfolder: f.subfolder || '', type: f.type || 'output' });
    const r = await fetch(`${pod}/view?${q}`); if (!r.ok) { console.log('  ดาวน์โหลดไม่ได้', r.status, f.filename); continue; }
    const name = `${e.project}_${e.taskId.slice(0, 8)}_${path.basename(f.filename)}`; fs.writeFileSync(path.join(e.outDir, name), Buffer.from(await r.arrayBuffer())); e.files.push(name);
  }
  e.downloaded = e.files.length > 0; if (!e.downloaded) e.note = 'ไม่พบไฟล์ในผล history (ดู history_*.json ใน outDir)';
  await syncTask(e);
  console.log(`  เก็บแล้ว ${e.project}: ${e.files.join(', ') || '(ไม่พบไฟล์ — ดู history ดิบ)'}  run=${e.costTimeSec ?? '?'}s  ~$${e.costUsd ?? '?'}`);
}

// ---------- main ----------
if (mode === 'status' || mode === 'collect') {
  const pod = await resolvePod(); const led = readLedger(); const mine = led.filter((e) => e.provider === 'runpod' && !e.downloaded);
  for (const e of mine) { try { await refresh(e, e.podUrl || pod); if (mode === 'collect' && e.status === 'SUCCESS') await collect(e, e.podUrl || pod); } catch (er) { console.log(`  ${e.project}: ${er.message}`); } }
  writeLedger(led); const now = Date.now();
  if (!mine.length) console.log('ไม่มีงาน RunPod ค้าง');
  for (const e of mine) console.log(`${e.status.padEnd(8)} ${e.project.padEnd(28)} id ${e.taskId.slice(0, 8)}  ส่งมา ${fmt(now - e.submittedAt)}`);
  await quit(0);
}
const pod = await resolvePod(); const entries = [];
for (const c of configs) { const e = await submitOne(c, pod); if (e) entries.push(e); }
if (!argv.go) { console.log(`\nDRY-RUN: ไม่ได้ส่งอะไร · pod ${pod} · ใช้ --go เพื่อส่ง (ใช้เวลา GPU ของ pod)`); await quit(0); }
if (argv.nowait) { console.log(`\nส่ง ${entries.length} งานเข้าคิวของ pod แล้ว — เช็ก: --status --pod-url ...  เก็บผล: --collect --pod-url ...  (อย่าปิด pod ก่อนงานเสร็จและโหลดคลิปแล้ว)`); await quit(0); }
for (const e0 of entries) { const led = readLedger(); const cur = led.find((x) => x.taskId === e0.taskId);
  for (;;) { await refresh(cur, pod); writeLedger(led); console.log(`[${fmt(Date.now() - cur.submittedAt)}] ${cur.project}: ${cur.status}`); if (FINAL.has(cur.status)) break; await sleep(POLL_MS); }
  if (cur.status === 'SUCCESS') { await collect(cur, pod); writeLedger(led); } }
await quit(0);
