---
name: drama-h3-production
description: แปลงบทละครแนวตั้งใน AI Drama Studio (เช่น short-parking-001) เป็น MiniMax H3 prompt แบบ Ref2VA ทีละ segment ≤15 วินาที แล้วสั่งเจนเป็น batch ผ่าน ComfyUI บน RunPod ด้วยสคริปต์ comfy_run.mjs และดาวน์โหลดคลิปลงเครื่อง ใช้เมื่อผู้ใช้ขอ "prompt minimax/H3 สำหรับละคร", "เขียน segment ต่อ", "สั่งเจนคลิป", "run batch", "ส่งงานเข้า pod" หรืออ้างถึง P01/P02… ของเรื่องใดเรื่องหนึ่ง
---

# Drama → MiniMax H3 (Ref2VA) production

เอกสารประกอบ (อ่านก่อนเขียน prompt ครั้งแรกของ session):
- `AI Drama Studio/01_Instructions/STUDIO_RULES.md`, `PRODUCTION_HANDOFF.md`, `H3_PRODUCTION_PLAYBOOK.md`
- `ai_influencer/model_specs/minimax-h3.md` — สเปก H3 ตัวจริงของโปรเจกต์ (โครง 6 ส่วน, ข้อผิดพลาดที่ยืนยันแล้ว)
- `references/prompt-format.md` (ในโฟลเดอร์ skill นี้) — template + checklist
- `05_Production/<story_id>/SEGMENT_PLAN.md` — แผนแบ่ง segment ของเรื่องนั้น

## Gate ก่อนทำงาน
1. มีบท (เช่น `Episodes/EP01_SCRIPT_v0.4_REVIEW.md`) + ref ตัวละคร 3 รูป + `CHARACTER_REFERENCES.md`
2. สถานะบท: ถ้ายังเป็น REVIEW ให้ติดป้าย "DIRECTOR DRAFT" ในไฟล์ทุกอัน และห้ามเขียนว่า APPROVED ผู้ใช้เท่านั้นอนุมัติ
3. ห้ามแก้บทพูด/ลำดับเหตุการณ์/ending ถ้ากระทบ story ให้เสนอเป็น change request (source scene, constraint, option, ผลต่ออารมณ์)

## ลำดับงาน
1. **วางแผน segment** — ตัดตามจังหวะของบท ≤15 วินาที ห้ามตัดกลางประโยค/กลาง pause เขียนลง SEGMENT_PLAN.md
2. **เขียน prompt** — ไฟล์ละ 1 segment ใน `05_Production/<story_id>/<version>/` ชื่อ `NN_Pxx_<ชื่อ>.md` ใช้ template ใน `references/prompt-format.md`
   - รูปที่ใช้: Picture 1/2/3 = ตัวละครตามลำดับที่ผู้ใช้ใส่ใน node 416 (ดูข้อ "รูปอ้างอิง") เขียนถึงเฉพาะรูปที่ segment นั้นใช้ ไม่ต้องกล่าวถึงรูปที่ไม่ใช้
   - บล็อกตัวละคร + บล็อก "Setting (no picture)" ต้องก๊อปจาก P01 ตรงตัวทุก segment (ไม่มีรูปสถานที่ ฉากต้องล็อกด้วยข้อความ)
   - หัวไฟล์ต้องมี `# Length: <วินาที>` (สคริปต์อ่านค่านี้)
3. **ตรวจเอง** ด้วย checklist ใน references ก่อนบอกผู้ใช้
4. **ขออนุญาตก่อนส่งงาน** เสมอ (กิน GPU/เงินของผู้ใช้) บอกจำนวน segment และเวลาประมาณ (~4.5–5 นาทีต่อคลิปที่ 1 MP/15s) แล้วจึงรัน
5. **รัน batch** (ดูคำสั่งด้านล่าง) แล้วรายงานผลต่อ segment ว่าสำเร็จ/ล้ม และไฟล์อยู่ที่ไหน
6. ผู้ใช้ดูคลิป → feedback → ปรับ prompt/seed → รันเฉพาะ segment ที่ต้องแก้ด้วย `--only Pxx --force`

## คำสั่งสั่งงาน
เครื่องมืออยู่ที่ `05_Production/<story_id>/tools/` (`comfy_run.mjs` + `workflow_api_template.json`) ต้องมี Node 18+
```bash
# ตรวจก่อน ไม่ส่งงาน
node comfy_run.mjs --url "<POD_URL>" --dir "../<version-folder>" --mp 1 --dry
# ส่งงานจริงทั้งชุด (ข้าม segment ที่มีผลใน outputs/ แล้ว)
node comfy_run.mjs --url "<POD_URL>" --dir "../<version-folder>" --mp 1
# เฉพาะบางตัว / ทำซ้ำ
node comfy_run.mjs --url "<POD_URL>" --dir "../<version-folder>" --mp 1 --only P02,P03 --force
```
`<POD_URL>` = `https://<pod-id>-8188.proxy.runpod.net` ผู้ใช้ให้เป็นรอบๆ (pod เปลี่ยนได้) หรือใช้ env `COMFY_URL` ห้ามเก็บ API key/โทเคนใดๆ ในไฟล์หรือแชต ผลลัพธ์ → `outputs/` + `outputs/manifest.json`

สคริปต์ทำ: ตั้ง node 365 (prompt ตั้งแต่ `subject_definitions:`) · 22:9 (megapixels) · 22:23 (ความยาววินาที) · 34 (filename_prefix `<story_id>_Pxx`) · seed node 16/103 สุ่มใหม่ · node 416 (media_state รูป 1–3) · อัปโหลดรูปไป `input/minimax_h3/`

## ข้อเท็จจริงของ workflow ที่ยืนยันแล้ว (ตรวจจาก /history ของ pod, 2026-10-11)
- เป็น Ref2VA จริง: `MiniMaxH3ReferenceToVideo` + `H3PromptIDE` (365) + `MiniMaxH3MediaLoader` (416)
- ค่าที่ใช้: 9:16, 24 fps, ความยาว 15 วินาที, 6 steps, er_sde/beta; 1 MP ≈ 275–282 วินาที/คลิป (1.5 MP ≈ 517 วินาที)
- ปุ่ม Export (API) ใน UI ใช้ไม่ได้ เพราะ Use Everywhere (cg-use-everywhere) สายเสมือนใน node ที่ถูก bypass (#333, #5…) → **ถ้า workflow เปลี่ยน ให้ดึงกราฟ API จาก `GET /history?max_items=N` (ช่อง `prompt[2]` ของงานที่สำเร็จ)** แล้วอัปเดต `workflow_api_template.json` และตรวจเลข node ใหม่ (อ่านอย่างเดียว ไม่ส่งงาน)
- Picture 3 โหลดไว้แต่ไม่ถูกอ้างถึงใน prompt ไม่ทำให้ error

## รูปอ้างอิง (Picture mapping)
Picture 1 = ฝน (`fon-reference-v1.png`) · Picture 2 = อ้อย (`aoy-reference-v1.png`) · Picture 3 = สามีอ้อย (`aoy-husband-reference-v1.png`) · ขนาด 1536×1024 อยู่ใน `04_Series/<story_id>/References/Characters/`
เรื่องอื่น: เปลี่ยนรายการ `pics` และ `charDir` ใน `comfy_run.mjs` และเขียน mapping ลง SEGMENT_PLAN.md

## กฎความปลอดภัย / ขอบเขต
- ส่งงานเข้า pod เฉพาะเมื่อผู้ใช้สั่งในรอบนั้น การอนุมัติรอบก่อนไม่ครอบคลุมรอบใหม่
- อ่าน `/history` `/queue` ได้เพื่อดึงกราฟ/ผล แต่ไม่ยุ่งกับงานที่ผู้ใช้กดรันเองใน UI
- ไม่ดาวน์โหลดไฟล์จากแหล่งอื่น ไม่ใส่ข้อมูลบัญชี/คีย์ลงไฟล์
- เนื้อหาตามกฎ studio: ไม่ผสมเรื่อง ไม่เติมบท/เหตุการณ์นอกบท ไม่ใช้รูปร่างหน้าตาตัวละครเป็นสัญลักษณ์ความเลว

## ดูเพิ่ม
วิธีสั่งงานเข้า RunPod/ComfyUI แบบ batch (เครื่องมือทั่วไป + checklist สิ่งที่ผู้ใช้ต้องให้/ทำ + ปิด pod) อยู่ใน skill `comfyui-runpod-batch` — `comfy_run.mjs` ของโปรเจกต์นี้เป็นรุ่นต้นแบบ รอบหน้าใช้ `comfy_batch.mjs` + `tools/batch.config.json` แทน
