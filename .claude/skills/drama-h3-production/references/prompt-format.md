# H3 Ref2VA prompt format (ใช้กับละครแนวตั้ง) — สรุปจาก ai_influencer/model_specs/minimax-h3.md + ผลทดสอบจริง P01

## Template ไฟล์ segment
```
# CONTENT — <story_id> · EP<nn> · Pxx (<ชื่อช่วง>) · <N>s
# Date: <วันที่จริง>
# Length: <N>
# Character: <ชื่อ (Picture n), ...> | Mode: Ref2VA (full-reference)
# Setting per request: ไม่มีรูป setting → บล็อก "Setting (no picture)" ต้องเหมือน P01 ทุกคำ
# Assumption: Picture mapping, speaker tags, สิ่งที่สมมติ
# Source: <ไฟล์บท + scene/ช่วงบรรทัด> · สถานะบท <REVIEW/APPROVED>
# Timing: <เวลาต่อ shot + พูดกี่วินาที + pause> · รวม <N>.0s

subject_definitions:
<Picture 1> <ชื่อ> - <identity ล็อกจาก ref/CHARACTER_REFERENCES.md> - <บทบาทใน segment>.
<Picture 2> ...                      (เขียนเฉพาะรูปที่ใช้)
Setting (no picture, ... identical in every segment): <ฉากเต็ม + ตำแหน่งรถ/บ้าน/ซ้าย-ขวา>

summary:
[reference generation] <ต่อจาก segment ก่อนหน้าอย่างไร + เกิดอะไรบ้าง>

retention_analysis:
<Picture 1> (appears in [Shot 1], ...): fully_preserved - ...
<Picture 2> (appears in ...): fully_preserved - ...

detailed_description:
<แสง/กล้อง/ซ้าย-ขวา ครั้งเดียว> <สถานะเปิดต่อจาก segment ก่อน> [Shot 1] ... [Shot 2] At MM:SS.mmm, the camera cuts ... 

overall_soundscape:
<เสียง diegetic เท่านั้น>

non_diegetic_music:
N/A
```
สคริปต์ส่งข้อความ "ตั้งแต่บรรทัด subject_definitions: ถึงท้ายไฟล์" ดังนั้น header (`#`) ไม่ถูกส่งเข้าโมเดล

## กฎที่ยืนยันแล้ว
- Shot แรกไม่มี timestamp; shot ถัดไปขึ้น `At MM:SS.mmm, the camera cuts ...` เวลาเพิ่มขึ้นเสมอ
- ทุก pause/beat มีตัวเลขวินาที ("a beat of about 0.8 seconds") ห้ามเขียนลอยๆ
- บทพูด: `<speaker> (S1/S2) says at a <pace> pace, <d>[Thai] ข้อความตรงจากบท</d>` ผู้พูดนอกจอที่ไม่ต้องมีรูป ใช้ (S2) ได้; ใส่ pace ทุกครั้ง
- ความยาว shot ≥ เวลาพูดจริง + pause: ไทย ≈ 2.5 คำ/วินาที ห้ามประกาศช่วงเวลาสั้นกว่าบทพูดต้องการ (ทำให้ภาพกระตุก/ภาพสลับ)
- รวมไม่เกิน ~15 วินาทีต่อ segment ตัดที่ shot boundary ไม่ตัดกลางประโยค
- ต้องมีบรรทัดแสงธรรมชาติ + "natural handheld phone-camera quality ... not overly polished or glossy" (กันภาพ AI slop)
- กล้องล็อก/ไม่ซูมซ้ำ: ถ้าต้องการกรอบเดิมให้เขียนเชิงลบ ("same distance, same angle, no zoom or reframe") ไม่ใช่ย้ำคำบรรยายกรอบ
- ข้อความบนจอมือถือ/ป้าย: อย่าให้โมเดลสร้าง เขียน "screen is not readable and does not change" แล้วทำข้อความใน edit
- ซ้าย-ขวาของตัวละครต้องบอกซ้ำใน prompt ทุก segment (ฝนซ้ายเฟรม อ้อยขวาเฟรม) กันเส้น 180° พัง
- ปฏิกิริยาต้องมี micro-tell เฉพาะ (กลืนน้ำลาย, ริมฝีปากเม้ม, แก้วค้างกลางอากาศ) ไม่ใช่ "she is angry"
- มือ/ของส่งต่อ: เขียน "the keys move only from A's hand to B's palm" และตรวจผลจริงเสมอ
- ห้ามสร้างเหตุการณ์/บทพูดนอกบท ห้ามเปลี่ยนภาษาให้เป็นทางการ

## Checklist ก่อนส่งผู้ใช้
- [ ] ทุกประโยคพูดตรงบทตัวต่อตัวอักษร (ตัวสะกด/ไม้ยมก/…)
- [ ] ทุก beat สำคัญของช่วงนั้นมี shot รองรับ ไม่มีบทใหม่
- [ ] เวลา shot รวม = ความยาวที่ประกาศ; เวลาเริ่ม shot ถัดไป = จบ shot ก่อน
- [ ] ความยาวเสียงพูด+pause ≤ ช่วงของ shot นั้น
- [ ] ระบุเฉพาะ Picture ที่ใช้; retention_analysis ตรงกับ shot ที่ปรากฏจริง
- [ ] ฉาก/ตัวละครก๊อปตรงกับ P01; ซ้าย-ขวาและตำแหน่งรถไม่ขัดกัน
- [ ] สถานะเปิดของ segment ตรงกับสถานะปิดของ segment ก่อนหน้า (props: กุญแจ/แก้ว/โทรศัพท์ต้องอยู่ที่เดิม)
- [ ] มี `# Length:` และ header ครบ ป้าย DIRECTOR DRAFT ถ้าบทยังไม่ APPROVED
- [ ] ไม่มี `""` นอก `<d>` และไม่มีข้อความบนจอที่ต้องให้โมเดลวาด

## ผลทดสอบจริงที่ต้องจำ
- P01 (4 shots, 15s, 1 MP, รูป 1+2 อ้างถึง/รูป 3 โหลดไว้): ผ่าน ใช้ได้ ~275–282 วินาที — format นี้ใช้งานได้
- ปัญหาที่ผู้ใช้พบระหว่างทดสอบให้เพิ่มลงที่นี่ทุกครั้ง (ฉากเพี้ยน, ซ้าย-ขวาสลับ, ภาษาไทย/ลิปซิงก์ ฯลฯ)

## บทเรียนจากคลิปจริง (เพิ่มทุกครั้งที่เจอ)
- **P13 (2026-10-11): ตัวละครที่ไม่อยู่ในช็อตโผล่เข้ามาเอง** — Picture 1 (ฝน) ถูกโหลดเป็นรูปอ้างอิงเสมอ ถึง shot นั้นจะไม่ได้เขียนถึงเธอ โมเดลก็ใส่เธอเข้ามายืนในฉาก (ทำให้ฝนปรากฏสองครั้ง: ยืนอยู่ก่อนแล้วขับรถมาถึง)
  **กฎ:** ถ้าตัวละครที่ Picture โหลดอยู่ ไม่อยู่ในช็อต ให้เขียนแบบปฏิเสธชัดเจนทั้งใน retention_analysis และใน shot นั้น เช่น "Fon <Picture 1> does not appear in [Shot 1]; the only people in the frame are ...; the driveway at frame left is completely empty with no person and no car" ทำทุก segment ที่มีตัวละครไม่อยู่ในบางช็อต (เสี่ยงสุด: segment ที่ตัวละครเข้า/ออกฉาก)
- การตรวจคลิป: ใช้ ffmpeg ดึงเฟรมทุก ~1.5 วินาทีทำ contact sheet (`ffmpeg -i clip.mp4 -vf "fps=1/1.5,scale=270:-1,tile=5x2" -frames:v 1 sheet.png`) แล้วดูว่าใครอยู่ในเฟรมตอนไหน ฟังเสียงไม่ได้ ให้ผู้ใช้ฟังเอง
- **ฉาก/รถไม่คงที่เมื่อไม่มีรูปสถานที่ (2026-10-11, short-parking-001 P01–P15):** บรรยายฉากเป็นข้อความอย่างเดียว ทำให้ยี่ห้อ/ทรง/ป้ายทะเบียนรถขาว และมุมบ้านเปลี่ยนไปมาระหว่างคลิป (ต้องเบลอป้าย/โลโก้ใน post)
  **ครั้งหน้า (ยังไม่ได้ทดสอบ):** (1) สร้างรูปสถานที่ชุดเดียว (เช้า/เย็น) แล้วใส่เป็น Picture ถัดไปทุก segment ตามสเปก H3 เดิมที่ใช้ Picture เป็น setting, หรือ (2) ใช้ first frame ต่อ segment ถ้า workflow รองรับ — ผู้ใช้ประเมินว่าน่าจะได้ผลดีกว่า ต้องตรวจโหมด/ความสามารถของ workflow ก่อน
