---
name: ugc-render-ops
description: ขั้นตอนสั่งเรนเดอร์วิดีโอ MiniMax H3 (workflow "Motion Context V2") ผ่าน API ไปที่ RunPod หรือ RunningHub โดยดึง prompt จาก Supabase, ส่งงาน, ติดตามสถานะ, เก็บ task/job id ลง ledger (ไฟล์ + ตาราง render_tasks) และโหลดคลิปกลับ — ใช้เมื่อผู้ใช้พูดถึง "สั่งงาน rh/runpod", "ดึง prompt จาก supabase", "เช็ก/เก็บผลงาน", "render_tasks", "ledger", "ตั้งค่า pod ใหม่", "แก้ sageattention", หรือขอ SOP การเรนเดอร์ Anong UGC
---

# UGC render ops — Supabase → RunPod / RunningHub → ledger → collect

สคริปต์ทั้งหมดอยู่ที่ `.claude/skills/comfyui-runpod-batch/scripts/` (Node 18+, ไม่มี dependency). ไฟล์ที่ skill นี้เพิ่ม: `sql/001_render_tasks.sql`, `templates/` (กราฟ API ของ RunPod และ RH, ตัวอย่าง config, `env.example`). ผู้ใช้เป็นคนกรอก `.env` เอง — **ห้ามเปิดอ่าน/พิมพ์/วาง key ในแชท**; ถ้าต้องตรวจว่ามี key ให้เช็กว่าตัวแปรไม่ว่างโดยไม่แสดงค่า

## กฎความปลอดภัย / การเงิน (ผู้ใช้กำหนด)
- **ทุกงานที่เสียเงิน (coins หรือเวลา GPU) ต้องได้ยืนยันในแชทก่อน** และถามเสมอว่าใช้ provider ไหน (ผู้ใช้ใช้เครดิต RunPod ที่มีอยู่ก่อน, RH ทีหลัง). สคริปต์เรนเดอร์ทุกตัวเป็น **dry-run เป็นค่าเริ่มต้น** — ส่งจริงเมื่อใส่ `--go`
- ก่อนส่งจริงต้องแจ้งผู้ใช้: provider, จำนวน segment/วินาที, ประมาณเวลา/ต้นทุน, รูปที่ใช้เป็น Picture 1/2
- อย่าหยุด/ลบ pod เอง (`runpod_pod.mjs stop|terminate` ต้องมี `--confirm` และผู้ใช้สั่ง); pod ที่เปิดค้างเสียค่าเช่าต่อ — เตือนผู้ใช้เมื่องานเสร็จ
- ผู้ใช้รัน `--status` / `--collect` เองเพื่อประหยัด token — ไม่ต้อง poll วนในแชท (ใช้ `--nowait` ตอนส่ง)
- การเขียนลง Supabase (`--push`, migration) ต้องบอกว่าจะเขียนอะไรก่อน

## ภาพรวมระบบ
| ชั้น | ที่อยู่ | บทบาท |
|---|---|---|
| prompt ที่ต้องทำ | Supabase `pipeline_content_items` (แถวหลัก = segment 1, segment 2..N ชี้ `parent_content_item_id` + `segment_number`; prompt อยู่ในคอลัมน์ `compiled_prompt`) | งานที่ต้องผลิต |
| ใบสั่ง/ผล | Supabase `render_tasks` (unique `provider,job_id`; status QUEUED/RUNNING/SUCCESS/FAILED/CANCELLED; run_seconds, coins, cost_usd, seed, seg_from/seg_count, local_path, drive_*) | ledger ทุกครั้งที่สั่ง (reroll = แถวใหม่) |
| รายการที่ยังไม่ทำ | view `render_todo` | เรื่องที่ยังไม่มี SUCCESS |
| ledger ในเครื่อง | `rh_tasks.json` ข้าง `.env` (ใช้ร่วมกันทั้ง rh/runpod แยกด้วย `provider`) | สำรองเมื่อ Supabase ใช้ไม่ได้ |
ตารางสร้างด้วย `sql/001_render_tasks.sql` (RLS เปิด ไม่มี policy, anon/authenticated ถูก revoke → เข้าได้เฉพาะ service_role ในสคริปต์) — โปรเจกต์เป้าหมายที่ใช้อยู่: "Test AI Influe" (ผู้ใช้เป็นคนยืนยัน/สลับ)

## ขั้นตอนมาตรฐาน (1 เรื่อง = 1 job ที่ต่อ segment ทั้งหมด)
1. **ดูว่ามีอะไรให้ทำ** — `node supabase_prompts.mjs --todo`
2. **ดึง prompt + สร้าง config**
   ```bash
   node supabase_prompts.mjs --pull <content_item_id> --out <โฟลเดอร์เรื่อง> \
     --images <Picture1.png>,<Picture2.png> --frames 336,312 --provider rp   # หรือ rh
   ```
   ได้ `H3_SEG<N>_prompt.txt` + `rp.<project>.config.json`; `--frames` = จำนวนเฟรมต่อ segment ที่ 24 fps (ผลคูณ frames × MP ≤ ~540 ต่อ segment)
   - **ส่ง prompt ใหม่เข้า Supabase** (เมื่อเขียนเสร็จเป็นไฟล์): `--push --dir <โฟลเดอร์> --title "…" --character anong` (dry-run; `--go` เขียนจริง → แถวหลัก + segment, status `pending`, model `minimax-h3`)
3. **Dry-run** (ไม่เสียเงิน) แล้วตรวจผลที่ได้ (จำนวน seg/วินาที/ประโยคบท/โหนด)
   - RunPod: `node runpod_render.mjs --config <cfg> --pod-url https://<pod-id>-8188.proxy.runpod.net`  (หรือ `--pod auto` ถ้ามี pod RUNNING ตัวเดียว + `RUNPOD_API_KEY`)
   - RunningHub: `node runninghub_run.mjs --config <cfg>`
4. **ได้ยืนยันแล้วส่งจริง**: เพิ่ม `--go --nowait` (ส่งหลายเรื่องพร้อมกันได้ `--config a.json,b.json`; RH API concurrency = 1 ต่อ Personal → งานต่อคิวที่ฝั่ง RH)
5. **ติดตามผล** (ผู้ใช้หรือผมรัน): `--status` (แสดงสถานะและเวลา; RH เตือนงาน SUCCESS ที่ยังไม่โหลดใกล้ 14 วัน) → `--collect` (โหลดคลิปลง `outDir` + บันทึก run_seconds/coins/cost_usd ลง ledger และ Supabase)
6. **ซิงก์ย้อนหลัง** ถ้า Supabase ใช้ไม่ได้ตอนส่ง: `node runninghub_run.mjs --sync-ledger`
7. **ส่งต่อทีมตัดต่อ**: ดู QC (contact sheet ด้วย ffmpeg), ถ้าไม่ผ่านให้ reroll เฉพาะ segment (ต้องมี latents ใน `output/easy_media/projects/<project>/` — บน RunPod อย่าลบ pod/volume ก่อนยืนยันว่าไม่ reroll)

## รายละเอียดแต่ละ provider
**RunningHub** (`runninghub_run.mjs`; ยืนยันแล้ว end-to-end 2026-10-13)
- base `https://www.runninghub.ai` — `POST /task/openapi/upload` (multipart: apiKey, file, fileType=input → `data.fileName` = `api/<sha256>.png` ใช้เป็น `images[].file_path` ใน track_data ได้ตรงๆ) → `/task/openapi/create` (apiKey, workflowId, nodeInfoList: node 29 `track_data`, node 15 `project_name` และ `seed`) → `/status` (QUEUED/RUNNING/SUCCESS/FAILED) → `/outputs` (`fileUrl`, `taskCostTime`, `consumeCoins`) ; `/cancel`
- คิดเงินเฉพาะเวลารันจริง (ไม่รวมเวลารอคิว): Standard 24 GB = 0.2 coins/วินาที; ตัวอย่าง test 5 วินาที ≈ 160 s = 32 coins; 2 segment ≈ 989 s ≈ 198 coins; ผลลัพธ์เก็บ ~14 วัน → โหลดเก็บทันที
- ต้องใช้บัญชีสมาชิกถ้าต้องการคลิปไม่มีลายน้ำ

**RunPod** (`runpod_render.mjs`; ยืนยันแล้ว 2026-10-14: คลิป 5 วินาที 0.2 MP ใช้ 97 วินาที ≈ $0.024 บน 4090)
- ไม่มี "workflow id" — ใช้กราฟ API-format `templates/workflow_api_runpod.json` (export จาก ComfyUI ของ pod; path โมเดลต่างจาก RH เช่น `H3/…`); config ต้องมีบล็อก `runpod: { template, gpu, hourlyUsd, outDir }`; ปรับได้: `megapixels`, `steps` (กราฟตั้ง 8; เดิมใช้ 6 → 8 ช้าขึ้น ~33% ช่วง sampling)
- ใช้ ComfyUI API: `/upload/image` → `/prompt` → `/history/<prompt_id>` (+ `/queue` แยก QUEUED/RUNNING) → `/view`; ต้นทุน = เวลา execute × ค่าเช่า/ชม. (ใส่ `hourlyUsd` ให้ตรง GPU: 4090 $0.89, 5090 $1.15)
- ตรวจ pod ที่เปิดอยู่: `GET https://rest.runpod.io/v1/pods` (Bearer `RUNPOD_API_KEY`; `desiredStatus: RUNNING`) แล้วลอง `GET <url>/system_stats` ให้ได้ HTTP 200 (502 = ComfyUI ยังไม่ขึ้น). ตรวจก่อนส่งทุกครั้ง
- สถานะ/หยุด pod: `runpod_pod.mjs` (status/stop/terminate ต้อง `--confirm`; ยังไม่เคยทดสอบกับ pod จริง)

### ตั้งค่า pod ใหม่ครั้งแรก (แก้ `sageattention`)
อาการ: งานล้มทันทีที่โหนด 27 `MiniMaxH3MemoryEfficientSageAttentionPatch` — `sageattention is not new enough version or could not determine CUDA architecture` (PyPI มีแค่ 1.0.6 แต่ต้อง 2.x). แก้โดย build จากซอร์สบน pod (ตัวอย่าง: torch 2.10+cu130, Python 3.12, nvcc 13.0, 4090 = sm_89; venv อยู่ที่ `/workspace/runpod-slim/ComfyUI/.venv-cu128`):
```bash
V=/workspace/runpod-slim/ComfyUI/.venv-cu128/lib/python3.12/site-packages/nvidia/cu13
export CPATH=$V/include:$CPATH LD_LIBRARY_PATH=$V/lib:$LD_LIBRARY_PATH TORCH_CUDA_ARCH_LIST="8.9" MAX_JOBS=4   # 5090 = 12.0
cd /workspace && git clone https://github.com/thu-ml/SageAttention.git && cd SageAttention
pip install --no-build-isolation -e . > /workspace/sage_build.log 2>&1; tail -3 /workspace/sage_build.log
python -c "from sageattention.core import get_cuda_arch_versions; print(get_cuda_arch_versions())"   # ต้องได้ ['sm89']
pkill -f main.py; cd /workspace/runpod-slim/ComfyUI && nohup python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header > /workspace/comfy.log 2>&1 &
```
- ถ้าขึ้น `fatal error: cusparse.h` = ไม่มีใน include path → ตั้ง `CPATH` ตามข้างบน (ใช้โฟลเดอร์ `nvidia/cu13/include` ให้ตรง CUDA ของ torch) ; build ~10–20 นาที
- build อยู่ใน venv บน network volume จึงอยู่ข้าม pod ได้ถ้าใช้ volume เดิม — pod/volume ใหม่ต้องทำซ้ำ
- ตั้งค่าอื่นที่ต้องมีบน pod: โมเดลชุด H3 (`H3/…` ใน UNET/CLIP/LoRA), `taeh3.safetensors`, `minimax_h3_latent_upscaler_3d_bf16.safetensors`, custom node ComfyUI-Easy-Media (yolain) และ KJNodes

## โครงสร้าง track_data ที่สคริปต์สร้าง (node 29)
`tracks[0]` (task) มี segments ต่อเนื่อง: `start_frame/end_frame` ที่ 24 fps, `continuity_mode`: segment 1 = `shot`, ที่เหลือ = `context`; `content.images[]` (`source_type: input`, `file_path` = ชื่อไฟล์ที่ upload), `user_prompt` = เนื้อ prompt ตั้งแต่ `subject_definitions:` เป็นต้นไป; `total_length` = ผลรวมเฟรม; node 15: `project_name` (ไม่ซ้ำต่อเรื่อง), `seed`, `sampling_mode: single`

## แก้ปัญหาที่เจอแล้ว
- Export (API) ไม่ทำงาน (`InvalidLinkError`) เพราะ Use Everywhere → ดึงกราฟจาก `/history` ด้วย `extract_graph.mjs`
- Windows: libuv assertion หลัง `process.exit` ขณะ fetch ค้าง → สคริปต์หน่วง 150 ms ก่อนออก (`quit()`)
- เวลารัน RH ที่ API ให้ = เวลารันจริง ไม่รวมคิว; Personal API concurrency = 1 (web = 2)
- เรนเดอร์กว้างกว่าที่เขียน (เห็นเต็มโซฟา) → องค์ประกอบของ Picture 1/2 มีผลต่อ framing; ดู `anong-ugc-h3-prompting`
- Supabase ledger เขียนไม่สำเร็จ = สคริปต์เตือนครั้งเดียวแล้วทำงานต่อ (ledger ไฟล์ยังอยู่) → รัน `--sync-ledger` ภายหลัง

## ที่ยังไม่ได้ทำ (เฟสหลัง)
อัปโหลดคลิปเข้า Google Drive อัตโนมัติ / edge function `render-collect` + pg_cron (ผู้ใช้ไม่ต้องการใช้ GCS); แก้ความปลอดภัยโปรเจกต์ Supabase อื่น (RLS ปิดอยู่หลายตาราง, edge function `process-phase2-batch` verify_jwt=false) — รายงานแล้ว รอผู้ใช้ตัดสิน
