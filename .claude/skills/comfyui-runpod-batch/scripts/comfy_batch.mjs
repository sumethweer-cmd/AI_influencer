#!/usr/bin/env node
// comfy_batch.mjs — สั่งงาน ComfyUI (RunPod หรือที่ไหนก็ได้) เป็น batch จากเครื่อง ผ่าน HTTP API
//   node comfy_batch.mjs --config <batch.config.json> --url <https://...-8188.proxy.runpod.net> [--only P01,P02] [--force] [--dry] [--check]
//   --check : ตรวจ URL/เซิร์ฟเวอร์ + ตรวจว่า node ทุกชนิดในกราฟมีติดตั้งบน pod (อ่านอย่างเดียว ไม่ส่งงาน)
//   --dry   : แสดงสิ่งที่จะส่ง ไม่ส่งงาน
//   --force : ทำซ้ำแม้มีผลลัพธ์ใน outDir แล้ว
// ส่งทุกงานเข้าคิวก่อน แล้วรอผลและดาวน์โหลดตามลำดับ · งานล้มไม่ทำให้ทั้งชุดล้ม · ไม่เก็บ key/secret ใดๆ
// ต้องใช้ Node 18+ (fetch/FormData ในตัว) · ไม่มี dependency ภายนอก
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const argv = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => {
  if (x.startsWith('--')) a.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return a;
}, []));
const die = (m) => { console.error('ERROR:', m); process.exit(1); };

if (!argv.config) die('ต้องระบุ --config <batch.config.json>');
const cfgPath = path.resolve(argv.config);
const cfgDir = path.dirname(cfgPath);
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const rel = (p) => path.resolve(cfgDir, p);

// URL: ตัด #fragment และ / ท้ายออก (URL ที่ copy จากเบราว์เซอร์มักมี #<workflow-id>)
const base = String(argv.url || process.env.COMFY_URL || '').replace(/#.*$/, '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) die('ต้องระบุ --url (หรือ env COMFY_URL) เช่น https://<pod-id>-8188.proxy.runpod.net');

const outDir = rel(cfg.outDir || 'outputs');
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(outDir, 'manifest.json');
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const get = async (p) => {
  const r = await fetch(base + p);
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status}` + (r.status === 404 || r.status === 502 ? " (pod อาจถูกหยุด/ลบ, ยังไม่พร้อม หรือ URL/พอร์ตผิด — ตรวจ RunPod console)" : ""));
  return r;
};

const template = () => JSON.parse(fs.readFileSync(rel(cfg.template), 'utf8'));
const node = (g, id) => { if (!g[id]) throw new Error(`template ไม่มี node ${id} (workflow เปลี่ยน? ดึงกราฟใหม่แล้วอัปเดต config)`); return g[id]; };

// ---------- --check ----------
if (argv.check) {
  const stats = await (await get('/system_stats')).json();
  console.log('เชื่อมต่อได้ · ComfyUI', stats.system?.comfyui_version ?? '', '· GPU:', stats.devices?.map((d) => d.name).join(', '));
  const info = await (await get('/object_info')).json();
  const g = template();
  const missing = [...new Set(Object.values(g).map((n) => n.class_type))].filter((c) => !info[c]);
  console.log(missing.length ? `node ที่ pod ไม่มี: ${missing.join(', ')}` : `node ทุกชนิดในกราฟ (${Object.keys(g).length} nodes) มีบน pod`);
  const q = await (await get('/queue')).json();
  console.log(`คิวตอนนี้: running ${q.queue_running?.length ?? 0}, pending ${q.queue_pending?.length ?? 0}`);
  process.exit(missing.length ? 2 : 0);
}

// ---------- หา jobs ----------
const nameRe = new RegExp(cfg.jobNameRegex || '_(P\\d+)');
const promptDir = rel(cfg.promptDir);
const marker = cfg.promptStart || 'subject_definitions:';
const only = argv.only ? String(argv.only).split(',') : null;
const jobs = fs.readdirSync(promptDir).filter((f) => nameRe.test(f) && f.endsWith('.md')).sort()
  .map((f) => ({ name: f.match(nameRe)[1], file: path.join(promptDir, f) }))
  .filter((j) => fs.readFileSync(j.file, 'utf8').includes(marker))
  .filter((j) => !only || only.includes(j.name));
if (!jobs.length) die('ไม่พบไฟล์ prompt ที่ตรงเงื่อนไข (ตรวจ promptDir / jobNameRegex / --only)');
const done = new Set(fs.readdirSync(outDir).map((f) => f.split('_')[0]));
const todo = jobs.filter((j) => argv.force || argv.dry || !done.has(j.name));
console.log('jobs:', jobs.map((j) => j.name).join(', '), '| จะทำ:', todo.map((j) => j.name).join(', ') || '(ไม่มี — ใช้ --force เพื่อทำซ้ำ)');

function readPrompt(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const text = raw.slice(raw.indexOf(marker)).trim();
  const m = raw.match(new RegExp('^' + (cfg.lengthHeader || '# Length:').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*([\\d.]+)', 'm'));
  return { text, seconds: m ? Number(m[1]) : (cfg.defaultSeconds ?? 15) };
}

// ---------- สร้างกราฟต่อ job ----------
function buildGraph(name, text, seconds) {
  const g = template();
  for (const s of cfg.set || []) node(g, s.node).inputs[s.input] = s.value;          // ค่าคงที่ทุกงาน (เช่น megapixels)
  node(g, cfg.promptNode.node).inputs[cfg.promptNode.input] = text;                   // prompt
  if (cfg.secondsNode) node(g, cfg.secondsNode.node).inputs[cfg.secondsNode.input] = seconds; // ความยาวต่อ job
  if (cfg.filenamePrefix) node(g, cfg.filenamePrefix.node).inputs[cfg.filenamePrefix.input] = cfg.filenamePrefix.template.replace('{name}', name);
  const seeds = (cfg.seedNodes || []).map((s) => {
    const v = Math.floor(Math.random() * 2 ** 48); node(g, s.node).inputs[s.input] = v; return v;
  });
  if (cfg.media?.mediaStateNode) {                                                     // MiniMax H3 Media Loader (media_state)
    const m = cfg.media;
    node(g, m.mediaStateNode.node).inputs[m.mediaStateNode.input] = JSON.stringify(m.files.map((f) => ({
      kind: 'picture', file: `${m.uploadSubfolder}/${f} [input]`, name: f, duration: null,
      width: m.width, height: m.height, has_audio: false, audio_mode: 'off', uid: 'mm' + crypto.randomBytes(5).toString('hex'),
    })));
  }
  return { g, seeds };
}

async function uploadMedia() {
  const m = cfg.media; if (!m) return;
  for (const f of m.files) {
    const fd = new FormData();
    fd.append('image', new Blob([fs.readFileSync(path.join(rel(m.dir), f))], { type: 'image/png' }), f);
    fd.append('subfolder', m.uploadSubfolder); fd.append('type', 'input'); fd.append('overwrite', 'true');
    const r = await fetch(base + '/upload/image', { method: 'POST', body: fd });
    console.log('upload', f, r.status);
    if (!r.ok) throw new Error('upload ล้ม ' + f + ' ' + (await r.text()).slice(0, 200));
  }
}

async function submit(j) {
  const { text, seconds } = readPrompt(j.file);
  const { g, seeds } = buildGraph(j.name, text, seconds);
  console.log(`\n== ${j.name} · ${path.basename(j.file)} · ${text.length} ตัวอักษร · ${seconds}s`);
  if (argv.dry) return { name: j.name, status: 'dry' };
  const r = await fetch(base + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g, client_id: crypto.randomUUID() }) });
  const body = await r.json();
  if (!r.ok) throw new Error('ส่งงานไม่ผ่าน ' + r.status + ' ' + JSON.stringify(body).slice(0, 1500));
  console.log('queued', body.prompt_id);
  return { name: j.name, status: 'queued', prompt_id: body.prompt_id, file: j.file, seeds, seconds, t0: Date.now() };
}

async function wait(job) {
  const maxMs = (cfg.timeoutMinutes ?? 180) * 60 * 1000;
  for (;;) {
    await sleep(10000);
    const e = (await (await get(`/history/${job.prompt_id}`)).json())[job.prompt_id];
    process.stdout.write(`\r${job.name} รอ ${Math.round((Date.now() - job.t0) / 1000)}s `);
    if (e?.status?.status_str === 'error') throw new Error('งาน error: ' + JSON.stringify(e.status.messages?.filter((m) => m[0] === 'execution_error')).slice(0, 1500));
    if (e?.status?.completed) {
      console.log();
      const o = e.outputs?.[cfg.outputNode]; const out = o?.gifs?.[0] || o?.videos?.[0] || o?.images?.[0];
      if (!out) throw new Error(`ไม่พบ output ของ node ${cfg.outputNode}`);
      const q = new URLSearchParams({ filename: out.filename, subfolder: out.subfolder || '', type: out.type || 'output' });
      const dest = path.join(outDir, `${job.name}_${out.filename}`);
      fs.writeFileSync(dest, Buffer.from(await (await get(`/view?${q}`)).arrayBuffer()));
      const secs = Math.round((Date.now() - job.t0) / 1000);
      console.log('saved', dest, `(${secs}s นับจากส่งเข้าคิว)`);
      return { name: job.name, status: 'ok', prompt_id: job.prompt_id, prompt_file: path.basename(job.file), seeds: job.seeds, seconds: job.seconds, out: path.basename(dest), took_s: secs };
    }
    if (Date.now() - job.t0 > maxMs) throw new Error('timeout');
  }
}

// รวม manifest กับไฟล์บนดิสก์ก่อนเขียนทุกครั้ง (กันหลาย process เขียนทับกัน)
function saveManifest(entry) {
  const disk = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  if (!disk.some((m) => m.prompt_id === entry.prompt_id)) disk.push({ ...entry, at: new Date().toISOString() });
  fs.writeFileSync(manifestPath, JSON.stringify(disk, null, 2));
}

// ---------- main ----------
if (!argv.dry && todo.length) await uploadMedia();
const results = [], queued = [];
for (const j of todo) {
  try { const r = await submit(j); (r.status === 'queued' ? queued : results).push(r); }
  catch (e) { console.error(`\n${j.name} ส่งไม่ผ่าน:`, e.message); results.push({ name: j.name, status: 'failed', error: e.message }); }
}
for (const q of queued) {
  try { const r = await wait(q); results.push(r); saveManifest(r); }
  catch (e) { console.error(`\n${q.name} ล้ม:`, e.message); results.push({ name: q.name, status: 'failed', error: e.message, prompt_id: q.prompt_id }); }
}
console.log('\nสรุป:'); results.forEach((r) => console.log(' ', r.name, r.status, r.out || r.error || ''));
process.exit(results.some((r) => r.status === 'failed') ? 3 : 0);
