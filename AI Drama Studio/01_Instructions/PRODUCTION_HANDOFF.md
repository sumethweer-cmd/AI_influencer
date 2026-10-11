# Claude Code — Production Contract
อ่าน STUDIO_RULES.md ประกอบ เอกสารนี้เป็น instruction ที่ต้องส่ง/ให้อ่านโดยตรง ไม่ได้ติดตั้ง runtime
## Input gate
ต้องมี story_id, approved script version, ผู้ใช้อนุมัติ exact version, canon snapshot และ visual references ที่อนุญาต
หาก approval หาย/ขัดกัน ให้หยุดการแปลงและรายงานสิ่งที่ขาด ไม่แต่ง approval ขึ้นเอง
## Allowed work
แตก approved script เป็น scenes/shots, image prompts, first/last-frame briefs และ MiniMax H3 video prompts
รักษาบทพูด ลำดับเหตุการณ์ แรงจูงใจ ความสัมพันธ์ และ ending ห้าม rewrite Creative
ตัดต่อเพื่อ staging ได้เมื่อไม่เปลี่ยนความหมาย ถ้ามีผลต่อ story ให้ส่ง change request: source scene, constraint, proposed option, emotional impact; รอ Creative/ผู้ใช้อนุมัติฉบับใหม่
## Traceability
แต่ละ shot มี shot_id, source_scene_id, source_lines/beat, character IDs, location/time, wardrobe/props, action, framing, camera motion, duration estimate, dialogue/audio, continuity in/out
Image brief: identity/reference IDs, composition, lighting, expression, visible action, constraints
First/last frame briefs: state ต้น/ปลายที่ต่อกันได้ ระบุ props/ตำแหน่ง/ทิศทาง ไม่สร้าง frame จริงหากยังไม่ได้ขอ
Video prompt: หนึ่ง action หลักต่อ shot การเคลื่อนไหวชัดเจน ไม่มีเหตุการณ์นอก approved script
อย่าสมมติ parameter หรือความสามารถ MiniMax H3 ตรวจชื่อรุ่นและ interface จริงก่อนส่ง generation แยก creative prompt ออกจาก settings ที่ตรวจแล้ว
## Output
บันทึก input version และ approval identifier ใน manifest แยก shot plan กับ prompt files ภายใต้ 05_Production/<story_id>/<version>/
รายงาน unresolved constraints และ shots ที่เสี่ยง รวมการเปลี่ยนภาพ/props/เวลาเพื่อให้ Creative ตรวจ
ก่อนจบตรวจทุก beat สำคัญมี shot รองรับ ไม่มีบทพูดใหม่ และ continuity ข้าม shot ไม่ขัดกัน
