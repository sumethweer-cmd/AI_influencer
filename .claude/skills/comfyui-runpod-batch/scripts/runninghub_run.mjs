#!/usr/bin/env node
// runninghub_run.mjs — สั่งงาน workflow "Motion Context V2" (H3 long take) บน RunningHub ผ่าน API (consumer)
// ยืนยันแล้วว่าใช้ได้จริง (2026-10-13): upload → create(nodeInfoList) → status → outputs → fileUrl
//
// ส่งงาน (ไม่รอ) — ใส่หลาย config คั่นด้วย , ได้ ส่งเข้าคิว RH ทีเดียว RH จะรันทีละงาน ไม่ต้องเฝ้า/ไม่มี pod ให้ปิด:
//   node runninghub_run.mjs --config a.json,b.json,c.json            # DRY-RUN (ค่าเริ่มต้น) แสดงสรุปอย่างเดียว ไม่ส่ง
//   node runninghub_run.mjs --config a.json,b.json --go --nowait     # ส่งจริงทุกงานแล้วจบ (บันทึก taskId ลง ledger)
//   node runninghub_run.mjs --config a.json[,b.json] --go [--poll 60]  # ส่งแล้วรอจนเสร็จและดาวน์โหลด (รันเป็น background; --poll = วินาทีระหว่างเช็ก ไม่กิน token)
// เช็ก/เก็บผล (ถูกและสั้น เหมาะให้รันเองหรือสั่งผ่านแชต ไม่กินโทเคนมาก):
//   node runninghub_run.mjs --status                                 # ตารางสถานะของงานที่ยังไม่ได้เก็บ (QUEUED/RUNNING/SUCCESS/FAILED)
//   node runninghub_run.mjs --collect                                # ดาวน์โหลดงานที่ SUCCESS แล้ว + บันทึกเวลา/coins
//   node runninghub_run.mjs --fetch <taskId> [--config x.json]       # ดึงผลของงานเดียว (รอจนเสร็จ)
// API key / workflowId: env หรือไฟล์ .env (RUNNINGHUB_API_KEY, RUNNINGHUB_WORKFLOW_ID) ค้นหาขึ้นไปจากโฟลเดอร์ของ config หรือ --env <path>
//   ห้ามพิมพ์/ส่ง key และ .env ห้ามอยู่ใน git · ledger (รายการงาน) เก็บข้างไฟล์ .env เป็น rh_tasks.json หรือกำหนด --ledger <path>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { syncTask, syncEnabled } from './ledger_sync.mjs';

const argv = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => {
  if (x.startsWith('--')) a.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return a;
}, []));
const die = (m) => { console.error('ERROR:', m); process.exit(1); };
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const quit = async (code = 0) => { await sleep(150); process.exit(code); };   // หน่วงนิดเดียวให้ socket ของ fetch ปิดก่อน (กัน libuv assertion บน Windows)
const POLL_MS = Math.max(5, Number(argv.poll) || 30) * 1000;   // ช่วงเช็กสถานะในสคริปต์ (วินาที) — ไม่กิน token; ปรับด้วย --poll 60
const uuid = () => crypto.randomUUID();
const configs = argv.config ? String(argv.config).split(',').map((s) => path.resolve(s.trim())).filter(Boolean) : [];
const mode = argv.status ? 'status' : argv.collect ? 'collect' : argv['sync-ledger'] ? 'sync' : argv.fetch ? 'fetch' : 'run';
if (mode === 'run' && !configs.length) die('ต้องระบุ --config a.json[,b.json,…] (หรือใช้ --status / --collect / --fetch)');

// ---------- .env ----------
function loadEnv() {
  let file = argv.env ? path.resolve(argv.env) : null;
  if (!file) {
    let d = configs[0] ? path.dirname(configs[0]) : process.cwd();
    for (let i = 0; i < 6; i++) {
      const f = path.join(d, '.env'); if (fs.existsSync(f)) { file = f; break; }
      const up = path.dirname(d); if (up === d) break; d = up;
    }
  }
  if (!file || !fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue;
    const v = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
  return file;
}
const envFile = loadEnv();
const key = process.env.RUNNINGHUB_API_KEY;
const sending = mode !== 'run' || argv.go;
if (sending && !key) die('ไม่พบ RUNNINGHUB_API_KEY — กรอกในไฟล์ .env' + (envFile ? ' (' + envFile + ')' : ' (ยังไม่พบไฟล์ .env)') + ' แล้ว Save (ห้ามวางคีย์ในแชต)');
const base = 'https://www.runninghub.ai';
const ledgerPath = argv.ledger ? path.resolve(argv.ledger) : path.join(envFile ? path.dirname(envFile) : (configs[0] ? path.dirname(configs[0]) : process.cwd()), 'rh_tasks.json');
const readLedger = () => (fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : []);
const writeLedger = (l) => fs.writeFileSync(ledgerPath, JSON.stringify(l, null, 2));
const redact = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'apiKey' ? '***' : v)));
const post = async (p, body) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ apiKey: key, ...body }) });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  return { http: r.status, json };
};
const FINAL = new Set(['SUCCESS', 'FAILED']);
const findUrls = (o, acc = []) => { if (typeof o === 'string') { if (/^https?:\/\/\S+\.(mp4|mov|webm|mp3|wav|png|jpg|webp)(\?\S*)?$/i.test(o)) acc.push(o); } else if (o && typeof o === 'object') Object.values(o).forEach((v) => findUrls(v, acc)); return acc; };
const fmt = (ms) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`; };

// ---------- track_data ----------
function loadCfg(cfgPath) {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const rel = (p) => path.resolve(path.dirname(cfgPath), p);
  if (!cfg.workflowId && process.env.RUNNINGHUB_WORKFLOW_ID) cfg.workflowId = process.env.RUNNINGHUB_WORKFLOW_ID;
  return { cfg, rel };
}
function buildTrackData({ cfg, rel }, imageNames) {
  const marker = cfg.promptStart || 'subject_definitions:';
  const readPrompt = (f) => { const raw = fs.readFileSync(rel(f), 'utf8').replace(/\r\n/g, '\n'); const i = raw.indexOf(marker); if (i < 0) die('ไม่พบ ' + marker + ' ใน ' + f); return raw.slice(i).trim() + '\n'; };
  let start = 0;
  const segs = cfg.segments.map((s, i) => {
    const seg = { id: uuid(), start_frame: start, end_frame: start + s.frames, color: 'var(--multitrack-task-bg)', content: {
      media_type: 'none', task_mode: 'ref', continuity_mode: i === 0 ? 'shot' : 'context', ref_image_size: 'max',
      images: imageNames.map((n) => ({ id: uuid(), source_type: 'input', file_path: n, file_name: n })), muted: false, volume_db: 0, user_prompt: readPrompt(s.prompt) } };
    start += s.frames; return seg;
  });
  return JSON.stringify({ muted: false, volume_db: 0, task_markers: [], task_overview: false, tracks: [
    { id: uuid(), name: 'Task 0', type: 'task', task_mode: 'default', color: 'var(--multitrack-task-bg)', muted: false, solo: false, volume_db: 0, locked: false, segments: segs },
    { id: uuid(), name: 'Video 0', type: 'video', color: 'var(--primary)', muted: false, solo: false, volume_db: 0, locked: false, segments: [], audio_locked: false } ], total_length: start, frame_rate: 24 });
}
const nodeInfo = (cfg, td) => [
  { nodeId: cfg.nodes.editor, fieldName: 'track_data', fieldValue: td },
  { nodeId: cfg.nodes.project, fieldName: 'project_name', fieldValue: cfg.projectName },
  { nodeId: cfg.nodes.project, fieldName: 'seed', fieldValue: Math.floor(Math.random() * 2 ** 48) },
];

// ---------- ส่งงาน 1 config ----------
async function submitOne(cfgPath) {
  const L = loadCfg(cfgPath); const { cfg, rel } = L;
  const imgs = cfg.images.map(rel); for (const p of imgs) if (!fs.existsSync(p)) die('ไม่พบรูป ' + p);
  if (!argv.go) {
    const td = JSON.parse(buildTrackData(L, imgs.map((p) => '<' + path.basename(p) + '>')));
    const segs = td.tracks[0].segments;
    console.log(`DRY  ${cfg.projectName}: ${segs.length} seg, ${(td.total_length / 24).toFixed(1)}s, รูป ${imgs.map((p) => path.basename(p)).join('+')}, บทไทย ${segs.reduce((n, s) => n + (s.content.user_prompt.match(/<d>\[Thai\]/g) || []).length, 0)} ประโยค, workflowId ${cfg.workflowId ? 'มี' : 'ยังไม่มี'}`);
    return null;
  }
  if (!cfg.workflowId) die('ใส่ workflowId ใน config หรือ .env (RUNNINGHUB_WORKFLOW_ID) ก่อน');
  const names = [];
  for (const p of imgs) {
    const fd = new FormData(); fd.append('apiKey', key); fd.append('fileType', 'input');
    fd.append('file', new Blob([fs.readFileSync(p)], { type: 'image/png' }), path.basename(p));
    const r = await fetch(base + '/task/openapi/upload', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (j.code !== 0 || !j.data?.fileName) die(`อัปโหลดล้ม ${path.basename(p)}: ${JSON.stringify(redact(j)).slice(0, 200)}`);
    names.push(j.data.fileName);
  }
  const ni = nodeInfo(cfg, buildTrackData(L, names));
  const c = await post('/task/openapi/create', { workflowId: String(cfg.workflowId), nodeInfoList: ni });
  if (c.json.code !== 0 || !c.json.data?.taskId) die(`สร้างงาน ${cfg.projectName} ไม่สำเร็จ: ${JSON.stringify(redact(c.json)).slice(0, 600)}`);
  const entry = { provider: 'runninghub', taskId: String(c.json.data.taskId), project: cfg.projectName, config: cfgPath, outDir: rel(cfg.outDir || 'rh_outputs'), submittedAt: Date.now(), status: c.json.data.taskStatus || 'QUEUED', downloaded: false,
    workflowId: String(cfg.workflowId), seed: ni.find((x) => x.fieldName === 'seed')?.fieldValue, segments: cfg.segments.length, totalFrames: cfg.segments.reduce((n, s) => n + s.frames, 0),
    promptVersion: cfg.segments.map((s) => path.basename(s.prompt)).join(' + '), contentItemId: cfg.contentItemId, storyKey: cfg.storyKey, segFrom: cfg.segFrom, segCount: cfg.segCount };
  const led = readLedger(); led.push(entry); writeLedger(led); await syncTask(entry);
  console.log(`ส่งแล้ว  ${cfg.projectName}  taskId=${entry.taskId}  promptTips=${String(c.json.data.promptTips || '').replace(/\s+/g, ' ').slice(0, 120)}`);
  return entry;
}

// ---------- สถานะ / เก็บผล ----------
async function refresh(entry) {
  if (FINAL.has(entry.status) && entry.finishedAt) return;
  const s = await post('/task/openapi/status', { taskId: entry.taskId });
  const st = typeof s.json.data === 'string' ? s.json.data : null; if (!st) return;
  if (st !== entry.status || !entry.seen) {
    if (st === 'RUNNING' && !entry.runningAt) entry.runningAt = Date.now();
    if (FINAL.has(st) && !entry.finishedAt) entry.finishedAt = Date.now();
    entry.status = st; entry.seen = true;
    await syncTask({ provider: 'runninghub', ...entry });
  }
}
async function collect(entry) {
  const o = await post('/task/openapi/outputs', { taskId: entry.taskId });
  fs.mkdirSync(entry.outDir, { recursive: true });
  fs.writeFileSync(path.join(entry.outDir, `outputs_${entry.taskId}.json`), JSON.stringify(redact(o.json), null, 2));
  const items = Array.isArray(o.json.data) ? o.json.data : [];
  entry.files = []; entry.costTimeSec = null; entry.coins = null;
  for (const it of items) { if (it.taskCostTime) entry.costTimeSec = Number(it.taskCostTime); if (it.consumeCoins) entry.coins = Number(it.consumeCoins); }
  for (const u of findUrls(o.json)) {
    const name = `${entry.project}_${entry.taskId}_${path.basename(new URL(u).pathname)}`;
    const r = await fetch(u); if (!r.ok) { console.log('  ดาวน์โหลดไม่ได้', r.status); continue; }
    fs.writeFileSync(path.join(entry.outDir, name), Buffer.from(await r.arrayBuffer())); entry.files.push(name);
  }
  entry.downloaded = entry.files.length > 0;
  entry.fileUrl = findUrls(o.json)[0];
  if (entry.coins != null && process.env.RH_COIN_USD) entry.costUsd = Number((entry.coins * Number(process.env.RH_COIN_USD)).toFixed(4));
  await syncTask({ provider: 'runninghub', ...entry });
  console.log(`  เก็บแล้ว ${entry.project}: ${entry.files.join(', ') || '(ไม่พบไฟล์)'}  run=${entry.costTimeSec ?? '?'}s  coins=${entry.coins ?? '?'}`);
}
async function statusTable(doCollect) {
  const led = readLedger(); const pending = led.filter((e) => !e.downloaded);
  for (const e of pending) await refresh(e);
  if (doCollect) for (const e of pending) if (e.status === 'SUCCESS' && !e.downloaded) await collect(e);
  writeLedger(led);
  const now = Date.now(); const cnt = {};
  for (const e of led) { const k = e.downloaded ? 'DONE(เก็บแล้ว)' : e.status; cnt[k] = (cnt[k] || 0) + 1; }
  const show = led.filter((e) => !e.downloaded);
  if (!show.length) console.log('ไม่มีงานค้าง');
  // RH เก็บไฟล์ผลลัพธ์ ~14 วัน (ผู้ใช้แจ้ง) — เตือนเมื่อใกล้หมดอายุ (นับอย่างระมัดระวังจากเวลาส่ง)
  const RETENTION_DAYS = Number(argv.retention) || 14;
  for (const e of show) {
    const left = RETENTION_DAYS - (now - e.submittedAt) / 86400000;
    const warn = e.status === 'SUCCESS' ? (left <= 0 ? '  ⚠ เกิน ' + RETENTION_DAYS + ' วันนับจากส่ง อาจหายแล้ว' : left <= 3 ? '  ⚠ เหลือ ~' + Math.ceil(left) + ' วัน รีบเก็บ' : '') : '';
    console.log(`${e.status.padEnd(8)} ${e.project.padEnd(28)} task ${e.taskId}  ส่งมา ${fmt(now - e.submittedAt)}${e.runningAt ? '  เริ่มรันหลัง ' + fmt(e.runningAt - e.submittedAt) : ''}${e.finishedAt ? '  เสร็จหลัง ' + fmt(e.finishedAt - e.submittedAt) : ''}${warn}`);
  }
  console.log('สรุป:', Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(' · '), '| ledger:', ledgerPath);
}

// ---------- main ----------
if (mode === 'sync') {
  if (!syncEnabled()) die('ยังไม่มี SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน .env');
  const led = readLedger(); let ok = 0;
  for (const e of led) { const r = await syncTask({ provider: 'runninghub', ...e }); if (r.ok) ok++; }
  console.log(`ซิงก์ ledger ขึ้น Supabase: ${ok}/${led.length} รายการ`); await quit(0);
}
if (mode === 'status') { await statusTable(false); await quit(0); }
if (mode === 'collect') { await statusTable(true); await quit(0); }
if (mode === 'fetch') {
  let e = readLedger().find((x) => x.taskId === String(argv.fetch));
  if (!e) { const outDir = configs[0] ? path.resolve(path.dirname(configs[0]), loadCfg(configs[0]).cfg.outDir || 'rh_outputs') : path.resolve('rh_outputs'); e = { taskId: String(argv.fetch), project: 'task', outDir, submittedAt: Date.now(), status: 'QUEUED', downloaded: false }; const led = readLedger(); led.push(e); writeLedger(led); }
  const led = readLedger(); e = led.find((x) => x.taskId === String(argv.fetch));
  for (;;) { await refresh(e); writeLedger(led); console.log(`[${fmt(Date.now() - e.submittedAt)}] ${e.status}`); if (FINAL.has(e.status)) break; await sleep(POLL_MS); }
  if (e.status === 'SUCCESS') { await collect(e); writeLedger(led); }
  await quit(0);
}
// mode === 'run'
const entries = [];
for (const c of configs) { const e = await submitOne(c); if (e) entries.push(e); }
if (!argv.go) { console.log(`\nDRY-RUN: ไม่ได้ส่งอะไร · .env: ${envFile || '(ไม่พบ)'} · API key: ${key ? 'มีค่า (ซ่อน)' : 'ว่าง'} · ใช้ --go เพื่อส่ง (--nowait = ส่งเข้าคิวแล้วจบ)`); await quit(0); }
if (argv.nowait) { console.log(`\nส่ง ${entries.length} งานเข้าคิวแล้ว — เช็กด้วย: node runninghub_run.mjs --status   เก็บผลด้วย: --collect`); await quit(0); }
for (const e of entries) {   // ไม่ --nowait: รอจนเสร็จทีละงาน
  const led = readLedger(); const cur = led.find((x) => x.taskId === e.taskId);
  for (;;) { await refresh(cur); writeLedger(led); console.log(`[${fmt(Date.now() - cur.submittedAt)}] ${cur.project}: ${cur.status}`); if (FINAL.has(cur.status)) break; await sleep(POLL_MS); }
  if (cur.status === 'SUCCESS') { await collect(cur); writeLedger(led); }
}
