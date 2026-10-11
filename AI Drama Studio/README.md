# AI Drama Studio

ระบบทำละครสั้นแนวตั้งภาษาไทยด้วย GenAI: บท (Creative) → prompt MiniMax H3 ทีละ segment ≤15 วินาที (Production) → สั่งเจนเป็น batch ผ่าน ComfyUI บน RunPod → ส่งต่อทีมตัดต่อ

- `01_Instructions/` — กฎ studio, สัญญา Production, playbook H3
- `04_Series/short-parking-001/` — เรื่อง "แค่จอดแป๊บเดียว": บท v0.4 (REVIEW), ตัวละคร, ภาพ reference ตัวละครสมมติ 3 รูป
- `05_Production/short-parking-001/` — แผน segment, prompt P01–P15 (`v0.4_REVIEW_DRAFT/`), เอกสารส่งทีมตัดต่อ, `tools/` (สคริปต์ + config)
- skills ที่เกี่ยวข้อง: `.claude/skills/drama-h3-production`, `.claude/skills/comfyui-runpod-batch`

สถานะ: บท v0.4 ยังเป็น REVIEW ไม่มีบันทึกอนุมัติ — ไฟล์ production ทั้งหมดเป็น DIRECTOR DRAFT · คลิปวิดีโอที่เจนแล้วไม่ถูกเก็บใน repo นี้
ตัวละครและเหตุการณ์เป็นเรื่องสมมติทั้งหมด
