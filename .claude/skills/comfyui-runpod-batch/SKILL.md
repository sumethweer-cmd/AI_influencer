---
name: comfyui-runpod-batch
description: สั่งงาน ComfyUI ที่รันบน RunPod (หรือเซิร์ฟเวอร์ ComfyUI ใดๆ) จากเครื่องผู้ใช้แบบ batch ผ่าน HTTP API — ส่ง prompt หลายไฟล์เข้าคิว รอผล ดาวน์โหลดวิดีโอ/รูปลงเครื่อง บันทึก manifest แล้วหยุด/ลบ pod ได้ ใช้เมื่อผู้ใช้พูดถึง "สั่งเจนบน runpod", "ส่งงานเข้า comfyui", "run batch", "ดึง workflow API", "ปิด/terminate pod", หรือขอให้ตั้งค่าการสั่งงานแบบนี้กับ workflow ใหม่ (สำหรับ MiniMax H3 ละครแนวตั้งดู drama-h3-production ประกอบ)
---

# ComfyUI + RunPod batch runner

> **เส้นทางในเครื่องอื่น/ใน repo AI_influencer:** `ai_influencer/model_specs/minimax-h3.md` = `model_specs/minimax-h3.md` (รากของ repo); `AI Drama Studio/` อยู่ที่รากของ repo; เริ่มจาก `AI Drama Studio/START_HERE.md` และ `05_Production/<story_id>/PRODUCTION_STATUS.md`

เครื่องมือสามตัวใน `scripts/` (Node 18+, ไม่มี dependency): ตรวจแล้วว่า `comfy_batch.mjs` ใช้ส่งงานจริงได้ (ทดสอบกับ pod จริง 15 คลิปเมื่อ 2026-10-11 ผ่านรุ่น `comfy_run.mjs` ที่เป็นต้นแบบ); `runpod_pod.mjs` ตรวจ endpoint กับเอกสาร RunPod แล้วแต่ **ยังไม่เคยรันกับ pod จริง**

| สคริปต์ | หน้าที่ |
|---|---|
| `extract_graph.mjs` | ดึงกราฟ API-format จาก `/history` ของ ComfyUI (อ่านอย่างเดียว) — ใช้เมื่อปุ่ม Export (API) ไม่ทำงาน |
| `comfy_batch.mjs` | อ่าน config + โฟลเดอร์ prompt → อัปโหลดรูป → ส่งทุกงานเข้าคิว → รอ → ดาวน์โหลด → manifest |
| `runpod_pod.mjs` | status / stop / terminate pod ผ่าน RunPod REST API (ต้องมี `RUNPOD_API_KEY` ใน env) |
| `runpod_render.mjs` | (UGC / Motion Context V2) สั่งงานเป็น 1 job ต่อ 1 เรื่องบน pod: อัปโหลดรูป → ใส่ track_data → `/prompt` → status/collect + ledger — ยืนยันแล้ว 2026-10-14 |
| `runninghub_run.mjs` | เหมือนกันแต่ส่งไป RunningHub API (`--go --nowait`, `--status`, `--collect`, `--fetch`, `--sync-ledger`) |
| `supabase_prompts.mjs` | `--todo` / `--pull` / `--push` prompt ระหว่าง Supabase กับไฟล์ + สร้าง config |
| `ledger_sync.mjs` | (ไลบรารี) upsert ledger ขึ้นตาราง `render_tasks` |

> งาน UGC ของ Anong ใช้ขั้นตอนใน skill `ugc-render-ops` (มี SOP, การตั้งค่า pod/SageAttention, ตาราง Supabase) และ `anong-ugc-h3-prompting` (การเขียนบท/shot/prompt)

## ผู้ใช้ต้องทำอะไร / ต้องให้ผมอะไร (checklist)
**ก่อนเริ่มทุกรอบ**
1. **เปิด pod และ ComfyUI ให้พร้อม** (workflow โหลดได้ ไม่มี node แดง โมเดลครบ) แล้วส่ง **ComfyUI URL** ของ pod มาให้: `https://<pod-id>-8188.proxy.runpod.net` (copy จากแถบ address จะมี `#...` ต่อท้าย ไม่เป็นไร สคริปต์ตัดให้) — pod ใหม่ = URL ใหม่ ต้องส่งใหม่ทุกครั้ง; RunPod URL (หน้า console) ไม่จำเป็น ยกเว้นต้องการให้ผมหยุด/ลบ pod (ใช้ pod id ชุดเดียวกับใน URL)
2. **workflow:** ถ้าเป็น workflow เดิม (มี `workflow_api_template.json` + `batch.config.json` ของโปรเจกต์นั้นอยู่แล้ว) ไม่ต้องทำอะไรเพิ่ม · ถ้าเป็น workflow ใหม่/แก้ไขแล้ว: **กด Run ใน ComfyUI หนึ่งครั้งให้สำเร็จ** (ใช้ค่าอะไรก็ได้) แล้วบอกผม ผมจะดึงกราฟจาก `/history` เอง
3. **ไฟล์ prompt** ต่อ segment ในโฟลเดอร์เดียว ชื่อมีรหัส เช่น `20_P01_...md` ขึ้นต้นด้วย header ที่มี `# Length: <วินาที>` และเนื้อหา prompt เริ่มที่บรรทัดตามที่ config กำหนด (ค่าเริ่มต้น `subject_definitions:`)
4. **รูปอ้างอิง** (ถ้า workflow ใช้): บอกว่ารูปไหนคือ Picture 1/2/3 และอยู่ที่ไหน
5. **ยืนยันการส่งงานทุกรอบ** — ผมจะไม่ส่งงานเข้า pod โดยไม่ถามก่อน (กินเวลา GPU/เงิน) บอกจำนวนงานและเวลาโดยประมาณก่อนเสมอ
**ตอนเจน**
6. อย่าปิด pod/อย่าปิดเทอร์มินัลหรือแอปที่สคริปต์รันอยู่ — ถ้าสคริปต์ตายกลางทาง งานที่เข้าคิวแล้วจะเจนต่อบน pod แต่จะไม่ถูกดาวน์โหลดอัตโนมัติ (ดึงผลทีหลังได้จาก `/history` ขณะ pod ยังเปิด)
7. ระหว่างเจนอย่าสั่งงานอื่นใน UI พร้อมกัน (จะแทรกคิว ช้าลง)
**ตอนปิด pod**
8. กด Stop/Terminate เองใน RunPod console (ง่ายสุด) **หรือ** ตั้ง `RUNPOD_API_KEY` เป็น environment variable ในเครื่อง (สร้างที่ RunPod → Settings → API Keys; ให้สิทธิ์เท่าที่จำเป็น; **ห้ามวางคีย์ในแชต/ไฟล์**; ตั้งแล้วต้องเปิดแอป/เทอร์มินัลใหม่ — ระวังอย่าปิดตอนสคริปต์ยังเจนอยู่) แล้วให้ผมสั่ง
9. Terminate ลบ container disk ถาวร — ใช้ได้ถ้าโมเดล/workflow อยู่บน network volume; ถ้าไม่มี volume ให้ใช้ Stop แทนถ้าจะเจนต่อ

## ขั้นตอนของผม (Claude) ต่อรอบงาน
1. **เตรียม config** (ครั้งแรกของ workflow): ดึงกราฟ → ระบุเลข node → เขียน `batch.config.json`
   ```bash
   node scripts/extract_graph.mjs --url "<URL>" --list                       # ดูงานล่าสุดใน history
   node scripts/extract_graph.mjs --url "<URL>" --latest-success --out workflow_api_template.json
   ```
   เปิดไฟล์ดู `class_type` + `_meta.title` เพื่อหา node ที่รับ prompt / ความยาว / seed / รูป / ชื่อไฟล์ผลลัพธ์ แล้วคัดลอก `templates/batch.config.example.json` มาแก้ (ตัวอย่างจริง: `AI Drama Studio/05_Production/short-parking-001/tools/batch.config.json`)
2. **ตรวจ** (อ่านอย่างเดียว):
   ```bash
   node scripts/comfy_batch.mjs --config batch.config.json --url "<URL>" --check   # เชื่อมต่อได้ + node ครบ + คิวว่างไหม
   node scripts/comfy_batch.mjs --config batch.config.json --url "<URL>" --dry     # ดูว่าจะส่งอะไร ความยาวต่อ job
   ```
   ถ้า `--check` ว่าไม่มี node ใด → custom node ไม่ได้ติดตั้งบน pod นี้; ถ้า 404 → pod หยุด/URL ผิด
3. **ขออนุญาตผู้ใช้** แล้วส่ง:
   ```bash
   node scripts/comfy_batch.mjs --config batch.config.json --url "<URL>"                   # ทั้งชุด (ข้ามงานที่มีผลแล้ว)
   node scripts/comfy_batch.mjs --config batch.config.json --url "<URL>" --only P05,P06    # เฉพาะบางตัว
   node scripts/comfy_batch.mjs --config batch.config.json --url "<URL>" --only P13 --force # เจนซ้ำ (ไฟล์ใหม่ได้เลขลำดับถัดไป ไม่ทับของเก่า)
   ```
   รันแบบ background; ตรวจ progress จากไฟล์ output; รายงานผลต่องาน
4. **ตรวจผลลัพธ์** ก่อนปิด pod: จำนวนไฟล์ใน `outDir` ครบ + `manifest.json` ตรง (+ ดูคลิปด้วย ffmpeg contact sheet)
5. **ปิด pod** เมื่อผู้ใช้สั่ง:
   ```bash
   node scripts/runpod_pod.mjs status <podId|URL>
   node scripts/runpod_pod.mjs stop <podId|URL> --confirm
   node scripts/runpod_pod.mjs terminate <podId|URL> --confirm --expect-dir <outDir> --expect-count <N>
   ```
   ยืนยันกับผู้ใช้อีกครั้งก่อน terminate; ตรวจชื่อ pod/volume ที่พิมพ์ออกมาว่าตรง

## config (`batch.config.json`) — ฟิลด์สำคัญ
`template` กราฟ API · `promptDir` + `jobNameRegex` (ดึงรหัสงานจากชื่อไฟล์) · `promptStart`/`lengthHeader`/`defaultSeconds` · `promptNode` / `secondsNode` / `filenamePrefix` / `seedNodes` / `set` (ค่าคงที่ทุกงาน เช่น megapixels) · `media` (รูปอ้างอิงสำหรับ MiniMax H3 Media Loader: ไฟล์, ขนาด, โฟลเดอร์อัปโหลด) · `outputNode` + `outDir` + `timeoutMinutes` · path ทั้งหมดสัมพันธ์กับไฟล์ config
เลข node แบบ `22:23` คือ node ใน subgraph (ใช้ตามที่เห็นในกราฟ API ได้ตรงๆ)

## ข้อควรรู้ / ปัญหาที่เจอจริง
- **ปุ่ม Export (API) ใช้ไม่ได้** กับ workflow ที่มี Use Everywhere (สายเสมือน) หรือ subgraph → `InvalidLinkError` ใน console; ใช้ `extract_graph.mjs` แทน (กราฟใน history มีสายครบเพราะเป็นสิ่งที่ส่งไปรันจริง)
- ComfyUI ไม่มี login: ใครรู้ URL proxy ก็ยิงงานได้ — ปิด pod เมื่อไม่ใช้
- ComfyUI รันทีละงาน ส่งหลายงานเข้าคิวไม่ทำให้เร็วขึ้น แต่ไม่เสียช่องว่างระหว่างงาน; เวลาจริงที่เห็น (MiniMax H3, 1 MP, 15 วินาที, 5090): ~282 วินาที/คลิป
- ค่าเช่าคิดตามเวลาที่ pod เปิด (ที่ 1.19 USD/ชม.: 15 คลิป ≈ 1.5 ชม. ≈ 1.8 USD ≈ 60 บาท รวมเจนซ้ำ)
- `--force` ไม่ทับไฟล์เดิม (ComfyUI ใส่เลขลำดับ `_00002`) — เทียบเวอร์ชันเก่า/ใหม่ได้
- รันสองสคริปต์พร้อมกันได้ manifest ไม่ทับกัน (รวมกับไฟล์บนดิสก์ก่อนเขียน)
- สคริปต์ไม่เก็บ/พิมพ์ API key; อย่าใส่ URL ที่มีโทเคนลงไฟล์
- เนื้อหา prompt/format ของ MiniMax H3 และกฎคุณภาพอยู่ใน skill `drama-h3-production` และ `ai_influencer/model_specs/minimax-h3.md`

## RunningHub (ทางเลือกที่ถูกกว่าสำหรับ Anong UGC) — `scripts/runninghub_run.mjs`
ยืนยันแล้ว (2026-10-13): upload → create(nodeInfoList: โหนด 29 `track_data`, โหนด 15 `project_name`/`seed`) → status → outputs(`fileUrl`, `taskCostTime`, `consumeCoins`) ใช้ได้จริง; คิดเงินเฉพาะเวลารัน (เวลารอคิวไม่คิด); ไม่มี pod ให้ปิด
- key/workflowId อยู่ใน `UGC/.env` (RUNNINGHUB_API_KEY, RUNNINGHUB_WORKFLOW_ID) — **ห้ามเปิดอ่าน/พิมพ์ค่า** สคริปต์อ่านเอง; .env ห้ามเข้า git
- ส่งหลายเรื่องเข้าคิวทีเดียว (RH รันทีละงาน; API concurrency ของ Personal = 1):
  `node runninghub_run.mjs --config a.json,b.json,c.json --go --nowait`  (ไม่ใส่ --go = dry-run)
- เช็กสถานะแบบสั้น (ไม่กินโทเคน): `node runninghub_run.mjs --status` · เก็บผล: `--collect` (ลง rh_outputs/ + บันทึก run วินาที/coins ใน ledger `rh_tasks.json`)
- ส่งงาน (`--go`) ต้องได้รับการยืนยันจากผู้ใช้ทุกครั้ง (ใช้ coins)
- config ต่อเรื่อง: `rh.<story>.config.json` (รูป Picture 1/2, segments: prompt + frames, projectName ไม่ซ้ำ) ตัวอย่างอยู่ใน `UGC/Weekly/…/01_Gray_Hair/`
