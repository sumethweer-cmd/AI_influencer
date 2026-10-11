#!/usr/bin/env node
// runpod_pod.mjs — ดูสถานะ / หยุด / ลบ pod ผ่าน RunPod REST API (https://rest.runpod.io/v1)
//   node runpod_pod.mjs status    <podId|comfyui-url>
//   node runpod_pod.mjs stop      <podId|comfyui-url> --confirm
//   node runpod_pod.mjs terminate <podId|comfyui-url> --confirm [--expect-dir <outputs> --expect-count <N>]
// Key อ่านจาก env RUNPOD_API_KEY เท่านั้น (ห้ามส่งใน argument/แชต/ไฟล์) · ไม่พิมพ์ key
// stop/terminate ต้องมี --confirm; terminate ลบ container disk ถาวร (network volume ไม่ถูกลบ) และตรวจจำนวนไฟล์ผลลัพธ์ก่อนถ้าระบุ --expect-*
// endpoint ตรวจกับเอกสาร RunPod แล้ว: GET /pods/{id}, POST /pods/{id}/stop, DELETE /pods/{id} (Bearer) — ยังไม่ได้ทดสอบกับ pod จริงในโปรเจกต์นี้
import fs from 'node:fs';

const [cmd, target, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.reduce((r, x, i, all) => {
  if (x.startsWith('--')) r.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return r;
}, []));
const key = process.env.RUNPOD_API_KEY;
if (!key) { console.error('ไม่พบ env RUNPOD_API_KEY — ตั้งเองในเครื่อง (อย่าวางคีย์ในแชต) แล้วเปิดเทอร์มินัล/แอปใหม่'); process.exit(1); }
if (!['status', 'stop', 'terminate'].includes(cmd) || !target) { console.error('ใช้: status|stop|terminate <podId|url>'); process.exit(1); }

// podId จาก URL แบบ https://<podId>-8188.proxy.runpod.net หรือใช้ id ตรงๆ
const m = String(target).match(/^https?:\/\/([a-z0-9]+)-\d+\.proxy\.runpod\.net/i);
const podId = m ? m[1] : target;
const api = 'https://rest.runpod.io/v1';
const call = (method, p) => fetch(api + p, { method, headers: { Authorization: `Bearer ${key}` } });

const r = await call('GET', `/pods/${podId}?includeNetworkVolume=true`);
if (!r.ok) { console.error(`GET pod ล้ม HTTP ${r.status} — ตรวจ podId/คีย์/สิทธิ์`); process.exit(1); }
const pod = await r.json();
console.log(`pod ${podId} · name: ${pod.name} · desiredStatus: ${pod.desiredStatus} · gpu: ${pod.machine?.gpuTypeId ?? pod.gpu?.id ?? '?'} · networkVolume: ${pod.networkVolume ? pod.networkVolume.name : 'ไม่มี'}`);
if (cmd === 'status') process.exit(0);
if (!flags.confirm) { console.error(`ต้องมี --confirm เพื่อ ${cmd} (ดูข้อมูลด้านบนก่อนว่าถูก pod)`); process.exit(1); }

if (cmd === 'terminate' && flags['expect-dir']) {
  const n = fs.readdirSync(flags['expect-dir']).filter((f) => /\.(mp4|mov|webm|png|jpg)$/i.test(f)).length;
  if (n < Number(flags['expect-count'] || 0)) { console.error(`ไฟล์ผลลัพธ์ใน ${flags['expect-dir']} มี ${n} < ${flags['expect-count']} — ไม่ terminate`); process.exit(1); }
  console.log(`ตรวจไฟล์ผลลัพธ์แล้ว: ${n} ไฟล์`);
}
const res = cmd === 'stop' ? await call('POST', `/pods/${podId}/stop`) : await call('DELETE', `/pods/${podId}`);
console.log(cmd, res.ok ? `สำเร็จ (HTTP ${res.status})` : `ล้ม HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
process.exit(res.ok ? 0 : 1);
