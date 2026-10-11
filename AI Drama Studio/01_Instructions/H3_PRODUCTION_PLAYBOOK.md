# H3 Production Playbook (Claude Code) — ต่อจาก PRODUCTION_HANDOFF.md
Version 1.0 | 2026-10-11 | ใช้คู่กับ skill `drama-h3-production` (`C:\AI Content\.claude\skills\drama-h3-production\SKILL.md`)

## หน้าที่
Claude Code แปลงบทเป็น MiniMax H3 prompts แบบ Ref2VA ทีละ segment ≤15 วินาที และสั่งเจนเป็น batch ผ่าน ComfyUI บน RunPod (สคริปต์ `05_Production/<story_id>/tools/comfy_run.mjs`) โดยไม่แก้เนื้อเรื่อง ตาม STUDIO_RULES และ PRODUCTION_HANDOFF

## ข้อตกลงกับผู้ใช้ (ยืนยันแล้วในการทดสอบ P01)
- ผู้ใช้ใส่รูปตัวละครเป็น Picture 1/2/3 เอง ไม่สลับรูปต่อ segment prompt เขียนถึงเฉพาะรูปที่ใช้
- ไม่มีรูปสถานที่ → ฉากเขียนเป็นข้อความ ต้องเหมือนกันทุก segment
- ผู้ใช้ตั้ง megapixels = 1 (node 22:9) เพื่อลดเวลา; ความยาวตามที่ segment ระบุ (node 22:23); ชื่อไฟล์ผลลัพธ์ตามเนื้อหา (node 34 → `<story_id>_Pxx`)
- บทพูดไทยใส่ใน `<d>[Thai] ...</d>`; เวลา shot ต้องพอดีกับความเร็วพูด

## Workflow การทำงานต่อรอบ
1. วางแผน/เขียน segment → ตรวจ checklist → รายงานผู้ใช้
2. ผู้ใช้ตรวจ prompt (หรือสั่งเจนเลย) → **ขออนุญาตก่อนส่งงานเข้า pod ทุกรอบ**
3. รัน `comfy_run.mjs` → ผลลง `outputs/` + `manifest.json`
4. ผู้ใช้ดูคลิป → เก็บ feedback → แก้ prompt/เจนซ้ำเฉพาะ segment (`--only Pxx --force`)
5. feedback ที่กระทบ story ส่งกลับ Creative เป็น change request

## สถานะ
บทยัง REVIEW → ไฟล์ทั้งหมดใน `05_Production/<story_id>/` เป็น DIRECTOR DRAFT จนกว่าผู้ใช้อนุมัติ exact version (บันทึก approved_by/at/version ตาม STUDIO_RULES) ห้ามกรอก approval เอง

## ข้อควรระวังเชิงเทคนิค
- Export (API) ใน ComfyUI UI ใช้ไม่ได้กับ workflow นี้ (Use Everywhere) → ดึงกราฟจาก `/history` (อ่านอย่างเดียว) เมื่อ workflow เปลี่ยน ดู skill
- ไม่ยืนยันความสามารถ H3 นอกสิ่งที่ทดสอบจริง; ภาษาไทย/ลิปซิงก์/ความต่อเนื่องข้ามคลิป ตรวจจากคลิปจริงเท่านั้น
- ห้ามเก็บ RunPod API key/โทเคนในไฟล์หรือแชต; ใช้ env var
