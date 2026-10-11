// comfy_run.mjs — ส่ง prompt MiniMax H3 (Ref2VA) เข้า ComfyUI บน RunPod แล้วดาวน์โหลดผลลัพธ์
// โหมดเดี่ยว: node comfy_run.mjs --url <pod url> --prompt <file.md> --name P01 [--seconds 15] [--mp 1] [--dry]
// โหมด batch : node comfy_run.mjs --url <pod url> --dir <โฟลเดอร์ prompt> [--only P02,P03] [--mp 1] [--dry] [--force]
//   batch จะหาไฟล์ที่ชื่อมี _P<เลข> และมี "subject_definitions:" ทำทีละไฟล์ตามลำดับ ข้ามถ้ามีผลใน outputs/ แล้ว (ยกเว้น --force)
//   ถ้างานไหนล้ม จะบันทึกแล้วทำอันถัดไปต่อ
// อ่าน prompt ตั้งแต่บรรทัด "subject_definitions:" ถึงท้ายไฟล์; ความยาวอ่านจากบรรทัด "# Length: <วินาที>" (ค่าเริ่มต้น 15)
// ไม่เก็บ key/secret ใด ๆ ในไฟล์นี้
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => {
  if (x.startsWith('--')) a.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return a;
}, []));

const base = String(args.url || process.env.COMFY_URL || '').replace(/\/+$/, '').replace(/\/#.*$/, '');
const megapixels = Number(args.mp ?? 1);
const dry = !!args.dry;
const force = !!args.force;
if (!base || (!args.prompt && !args.dir)) {
  console.error('ต้องระบุ --url (หรือ env COMFY_URL) และ --prompt/--name หรือ --dir'); process.exit(1);
}

// Node IDs ของ workflow (ตรวจจาก history ของ pod เมื่อ 2026-10-11)
const N = { prompt: '365', media: '416', res: '22:9', secs: '22:23', final: '34', seeds: ['16', '103'] };

// รูปอ้างอิงตัวละคร: Picture 1 = ฝน, 2 = อ้อย, 3 = สามีอ้อย
const charDir = path.resolve(here, '..', '..', '..', '04_Series', 'short-parking-001', 'References', 'Characters');
const pics = [
  { file: 'fon-reference-v1.png' },
  { file: 'aoy-reference-v1.png' },
  { file: 'aoy-husband-reference-v1.png' },
];
const outDir = path.resolve(here, '..', 'outputs');
const manifestPath = path.join(outDir, 'manifest.json');
fs.mkdirSync(outDir, { recursive: true });
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
// รวมกับไฟล์บนดิสก์ก่อนเขียนทุกครั้ง (กันหลาย process เขียนทับกัน)
const saveManifest = () => {
  const disk = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  const seen = new Set(disk.map((m) => m.prompt_id));
  const merged = disk.concat(manifest.filter((m) => !seen.has(m.prompt_id)));
  fs.writeFileSync(manifestPath, JSON.stringify(merged, null, 2));
};

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const uid = () => 'mm' + crypto.randomBytes(5).toString('hex');
const template = () => JSON.parse(fs.readFileSync(path.join(here, 'workflow_api_template.json'), 'utf8'));

function readPrompt(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const at = raw.indexOf('subject_definitions:');
  if (at < 0) throw new Error('ไม่พบ "subject_definitions:" ใน ' + file);
  const m = raw.match(/^# Length:\s*([\d.]+)/m);
  return { text: raw.slice(at).trim(), seconds: m ? Number(m[1]) : 15 };
}

function buildGraph(name, text, seconds) {
  const g = template();
  const must = (id) => { if (!g[id]) throw new Error('template ไม่มี node ' + id); return g[id]; };
  must(N.prompt).inputs.prompt = text;
  must(N.res).inputs.megapixels = megapixels;
  must(N.secs).inputs.value = seconds;
  must(N.final).inputs.filename_prefix = `short-parking-001_${name}`;
  const seeds = N.seeds.map(() => Math.floor(Math.random() * 2 ** 48));
  N.seeds.forEach((s, i) => { must(s).inputs.seed = seeds[i]; });
  must(N.media).inputs.media_state = JSON.stringify(pics.map((p) => ({
    kind: 'picture', file: `minimax_h3/${p.file} [input]`, name: p.file, duration: null,
    width: 1536, height: 1024, has_audio: false, audio_mode: 'off', uid: uid(),
  })));
  return { g, seeds };
}

async function uploadPics() {
  for (const p of pics) {
    const fd = new FormData();
    fd.append('image', new Blob([fs.readFileSync(path.join(charDir, p.file))], { type: 'image/png' }), p.file);
    fd.append('subfolder', 'minimax_h3'); fd.append('type', 'input'); fd.append('overwrite', 'true');
    const r = await fetch(base + '/upload/image', { method: 'POST', body: fd });
    console.log('upload', p.file, r.status);
    if (!r.ok) throw new Error('upload ล้ม ' + p.file + ' ' + (await r.text()).slice(0, 200));
  }
}

// ส่งงานเข้าคิว (ยังไม่รอผล)
async function submitJob(name, file) {
  const { text, seconds } = readPrompt(file);
  const { g, seeds } = buildGraph(name, text, seconds);
  console.log(`
== ${name} · ${path.basename(file)} · ${text.length} ตัวอักษร · ${seconds}s · ${megapixels} MP`);
  if (dry) return { name, status: "dry" };
  const r = await fetch(base + "/prompt", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: g, client_id: crypto.randomUUID() }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error("ส่งงานไม่ผ่าน " + r.status + " " + JSON.stringify(body).slice(0, 1500));
  console.log("queued", body.prompt_id);
  return { name, status: "queued", prompt_id: body.prompt_id, file, seeds, seconds, t0: Date.now() };
}

// รอผลงานที่อยู่ในคิว แล้วดาวน์โหลด
async function waitJob(job) {
  for (;;) {
    await sleep(10000);
    const h = await (await fetch(`${base}/history/${job.prompt_id}`)).json();
    const entry = h[job.prompt_id];
    process.stdout.write(`${job.name} รอ ${Math.round((Date.now() - job.t0) / 1000)}s `);
    if (entry?.status?.status_str === "error") {
      throw new Error("งาน error: " + JSON.stringify(entry.status.messages?.filter((m) => m[0] === "execution_error")).slice(0, 1500));
    }
    if (entry?.status?.completed) {
      console.log();
      const out = entry.outputs?.[N.final]?.gifs?.[0];
      if (!out) throw new Error("ไม่พบ output ของ node " + N.final);
      const q = new URLSearchParams({ filename: out.filename, subfolder: out.subfolder || "", type: out.type || "output" });
      const v = await fetch(`${base}/view?${q}`);
      const dest = path.join(outDir, `${job.name}_${out.filename}`);
      fs.writeFileSync(dest, Buffer.from(await v.arrayBuffer()));
      const secs = Math.round((Date.now() - job.t0) / 1000);
      console.log("saved", dest, `(${secs}s นับจากส่งเข้าคิว)`);
      return { name: job.name, status: "ok", prompt_id: job.prompt_id, prompt_file: path.basename(job.file), seeds: job.seeds, mp: megapixels, seconds: job.seconds, out: path.basename(dest), took_s: secs };
    }
    if (Date.now() - job.t0 > 3 * 60 * 60 * 1000) throw new Error("timeout 3 ชั่วโมง");
  }
}

// ---- main ----
let jobs = [];
if (args.dir) {
  const only = args.only ? String(args.only).split(',') : null;
  jobs = fs.readdirSync(args.dir).filter((f) => /_P\d+/.test(f) && f.endsWith('.md')).sort()
    .map((f) => ({ name: f.match(/_(P\d+)/)[1], file: path.join(args.dir, f) }))
    .filter((j) => fs.readFileSync(j.file, 'utf8').includes('subject_definitions:'))
    .filter((j) => !only || only.includes(j.name));
} else {
  if (!args.name) { console.error('โหมดเดี่ยวต้องมี --name'); process.exit(1); }
  jobs = [{ name: args.name, file: args.prompt }];
  if (args.seconds) { /* ความยาวมาจาก # Length ในไฟล์; --seconds ใช้ทับเฉพาะโหมดเดี่ยว */ }
}
const done = new Set(fs.readdirSync(outDir).map((f) => f.split('_')[0]));
const todo = jobs.filter((j) => force || dry || !done.has(j.name));
console.log('jobs:', jobs.map((j) => j.name).join(', '), '| จะทำ:', todo.map((j) => j.name).join(', ') || '(ไม่มี)');
if (!dry && todo.length) await uploadPics();

const results = [];
// 1) ส่งทุกงานเข้าคิวก่อน (ปิดสคริปต์ได้ งานในคิวไม่หาย) 2) รอผลทีละงานตามลำดับ
const queued = [];
for (const j of todo) {
  try {
    const res = await submitJob(j.name, j.file);
    if (res.status === "queued") queued.push(res); else results.push(res);
  } catch (e) { console.error(`\n${j.name} ส่งไม่ผ่าน:`, e.message); results.push({ name: j.name, status: "failed", error: e.message }); }
}
for (const q of queued) {
  try {
    const res = await waitJob(q);
    results.push(res);
    manifest.push({ ...res, at: new Date().toISOString() }); saveManifest();
  } catch (e) { console.error(`\n${q.name} ล้ม:`, e.message); results.push({ name: q.name, status: "failed", error: e.message, prompt_id: q.prompt_id }); }
}
console.log("\nสรุป:"); results.forEach((r) => console.log(" ", r.name, r.status, r.out || r.error || ""));
