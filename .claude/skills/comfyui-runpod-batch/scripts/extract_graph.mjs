#!/usr/bin/env node
// extract_graph.mjs — ดึงกราฟ API-format ของ ComfyUI จาก /history (อ่านอย่างเดียว ไม่ส่งงาน ไม่แตะคิว)
// ใช้เมื่อปุ่ม Export (API) ใน UI ไม่ทำงาน (เช่น workflow ที่ใช้ Use Everywhere/subgraph)
//   node extract_graph.mjs --url <comfyui url> --list [--max 10]        # ดูรายการงานล่าสุด
//   node extract_graph.mjs --url <comfyui url> --id <prompt_id> --out workflow_api_template.json
//   node extract_graph.mjs --url <comfyui url> --latest-success --out workflow_api_template.json
import fs from 'node:fs';

const a = Object.fromEntries(process.argv.slice(2).reduce((r, x, i, all) => {
  if (x.startsWith('--')) r.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return r;
}, []));
const base = String(a.url || process.env.COMFY_URL || '').replace(/#.*$/, '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) { console.error('ต้องระบุ --url'); process.exit(1); }

const h = await (await fetch(`${base}/history?max_items=${a.max || 10}`)).json();
const rows = Object.entries(h).map(([id, v]) => ({
  id, nodes: Object.keys(v.prompt[2]).length, status: v.status?.status_str,
  outputs: Object.keys(v.outputs || {}).length, graph: v.prompt[2],
}));
if (a.list || (!a.id && !a['latest-success'])) {
  rows.forEach((r) => console.log(r.id, '| nodes', r.nodes, '|', r.status, '| output nodes', r.outputs));
  process.exit(0);
}
const pick = a.id ? rows.find((r) => r.id === a.id) : rows.find((r) => r.status === 'success');
if (!pick) { console.error('ไม่พบงานที่ต้องการใน history'); process.exit(1); }
if (!a.out) { console.error('ต้องระบุ --out <ไฟล์.json>'); process.exit(1); }
fs.writeFileSync(a.out, JSON.stringify(pick.graph, null, 2));
console.log(`บันทึกกราฟ ${pick.nodes} nodes จากงาน ${pick.id} (${pick.status}) → ${a.out}`);
console.log('ต่อไป: เปิดไฟล์ดู class_type/title ของ node ที่รับ prompt, ความยาว, seed, รูป, ชื่อไฟล์ผลลัพธ์ แล้วใส่เลข node ใน batch.config.json');
