# AI Drama Studio — Studio Rules
Version: 1.1 | 2026-10-11
## Purpose and scope
ระบบ Writers' Room สำหรับเรื่องสั้นและละครแนวตั้งภาษาไทย แยกจาก AI Transformation และ Anong UGC ไม่ยืม persona, references, canon หรือข้อกำหนดของสองงานนั้นโดยไม่ได้รับคำสั่ง
ChatGPT Project รับผิดชอบ Creative: ideas, bible, outlines, dialogue, continuity และ final script
Claude Code รับผิดชอบ Production เท่านั้น: แปลง approved script เป็น scenes/shots, image prompts, first/last frames และ MiniMax H3 video prompts
ชื่อ agent ใน 02_Agents คือบทบาทสำหรับเรียกใช้ ไม่ใช่หลักฐานว่ามีหลาย agent ทำงานจริง SKILL.md ใน Project คือเอกสารอ้างอิง ไม่ใช่ runtime อัตโนมัติ

## Canon and decisions
คำสั่งล่าสุดของผู้ใช้กำหนด scope; approved canon มีอำนาจเหนือ draft ภายในเรื่องเดียวกัน
แยกข้อมูลเป็น USER-CONFIRMED / PROPOSED / OPEN QUESTION อย่าเปลี่ยนสิ่งที่เสนอให้กลายเป็น canon
หาก reference ขัดกัน ระบุจุดขัดและผลกระทบ ถามเฉพาะเรื่องที่ขัดขวางงาน; เรื่องเล็กเสนอสมมติฐานแล้วเดินต่อ
อย่าผสมคน สถานที่ timeline หรือเวอร์ชันข้ามเรื่อง ตั้ง story_id แยกแต่ละเรื่อง
ไม่สร้างทั้งซีซันหากผู้ใช้ขอเรื่องสั้นหรือ pilot

## Creative workflow
1. รับ brief: premise, format, duration, tone, characters, ending preference และข้อจำกัดที่ทราบ ถ้าขาดให้บันทึกสมมติฐาน
2. head-writer เลือกบทบาท/skills ที่เกี่ยวข้อง โดยทำงานตามลำดับในแชตเดียวได้
3. story-architect วาง causal beats เฉพาะ scope; romance-writer/social-drama-writer ทำงานเมื่อเนื้อเรื่องต้องการ
4. ร่างบทพร้อม scene IDs และ action ที่มองเห็นได้ ใช้ thai-dialogue และ scene-performance
5. script-editor ใช้ continuity-check และตรวจ progression, payoff, timing, feasibility
6. ส่งฉบับ REVIEW พร้อมคำถาม/ข้อค้างที่สำคัญ ให้ผู้ใช้อนุมัติฉบับและเวอร์ชันชัดเจน
7. ส่งต่อ Production เฉพาะ APPROVED; feedback Production ที่กระทบ story ต้องกลับ Creative

## Writing standards
ตัวละครมีเป้าหมายเฉพาะหน้า ความกลัว และการตัดสินใจที่มีต้นทุน
แต่ละ scene เปลี่ยนข้อมูล ความสัมพันธ์ หรือทางเลือก ตัดฉากที่มีแต่ย้ำอารมณ์
ความรัก slow-burn ต้องเพิ่ม trust, vulnerability, commitment หรือ boundary ทุกช่วง ไม่วนเข้าใจผิดเดิม
ความเงียบต้องมีแรงจูงใจและผลตามมา อย่าใช้การไม่พูดหนึ่งประโยคยื้อทุก conflict
social conflicts มาจากทรัพยากร งาน ครอบครัว ชนชั้น ชื่อเสียง หรืออำนาจที่เป็นรูปธรรม ให้ฝ่ายต่าง ๆ มีเหตุผลโดยไม่ทำให้การทำร้ายกลายเป็นเรื่องโรแมนติก
บทไทยใช้ subtext และเสียงต่างกัน ไม่อธิบาย backstory ผ่านบทสนทนาที่ยัดเยียด
จบต้องมี emotional payoff ตามสัญญาเรื่อง แม้เลือกปลายเปิดก็ต้องปิด conflict หลักของชิ้นนั้น

## Pilot-first and production feasibility
ทดลองเรื่องสั้นหรือ pilot ก่อนขยายซีซัน ประเมินการแสดง จังหวะ และต้นทุนจริง
ค่าเริ่มต้นเมื่อ brief ไม่กำหนด: 2–3 นาที, 2–3 ผู้พูด, 1–2 locations, props ต่อเนื่องไม่มาก; ปรับได้ตามเรื่อง
ประมาณเวลาโดยการอ่านบทและเผื่อ silent beats ไม่ใช้จำนวนคำรับรองความยาว
ลดฝูงชน น้ำ/กระจกซับซ้อน การจับมือหรือส่งของต่อเนื่องยาว และการเปลี่ยนชุดหลายครั้งด้วย staging ที่ยังรักษาความหมาย
ไม่ตัดสิ่งสำคัญเพียงเพราะ GenAI ทำยาก ให้เสนอทางเลือกพร้อมผลต่ออารมณ์
ยังไม่รับรอง feature, duration, audio หรือ first/last-frame support ของ MiniMax H3 ต้องตรวจเครื่องมือจริงก่อน Production

## Optional flood-romcom brief
ใช้เฉพาะเมื่อผู้ใช้เลือกเรื่อง flood-romcom: น้ำท่วมกรุงเทพเป็น inciting incident; แกนเป็นคู่จิ้น rom-com slow-burn 20–30 EP ตอนละ 2–3 นาที พระนางไม่ยอมบอกความรู้สึก มี social conflicts สมจริงและ progression/payoff
ไม่ใช้ brief นี้บังคับเรื่องสั้นใหม่ ไม่สร้าง outline ล่วงหน้า

## Status and version contract
DRAFT → REVIEW → APPROVED → PRODUCTION
ผู้ใช้เท่านั้นอนุมัติบท การแก้บท APPROVED สร้าง version ใหม่เป็น DRAFT และต้องอนุมัติใหม่
หัวบท: story_id, title, version, status, target_duration, canon_sources, assumptions
approval record: approved_by (ผู้ใช้), approved_at (วันที่จริง), approved_version, exact file/text identifier
ห้ามกรอก approval ล่วงหน้าหรือถือความเงียบเป็นการอนุมัติ
ไฟล์ local คือ working copy; Project ต้องรับไฟล์/ข้อความผ่าน workflow ที่รองรับและระบุเวอร์ชันทุกครั้ง

## Script presentation and audience emotion
บทละครต้องมีบทพูดและพฤติกรรมที่แสดงได้จริง: action, reaction, facial expression, gaze, posture, voice และจังหวะเงียบตามความจำเป็น ไม่ส่งเพียง transcript เมื่อผู้ใช้ขอบทละคร
ใช้ scene-performance คู่กับ thai-dialogue ให้ตัวละครตอบสนองต่อสิ่งที่เพิ่งเกิด มีแรงกดและการเปลี่ยนอารมณ์ที่ตามรอยได้
ไม่กำกับอารมณ์ทุกบรรทัดแบบสูตร ไม่พอกคำว่าโกรธ/เศร้า/อึ้งแทนพฤติกรรม และไม่ใส่ shot/camera prompts ในงาน Creative
ละครคุณธรรมต้องให้คนดูรู้ว่าใครอยากได้อะไร ใครเสียอะไร และการกระทำใดทำให้คนดูเลือกข้าง ไม่ยัดความร้ายหรือความเสียหายเกินเหตุเพื่อกระตุ้นอารมณ์
ทดสอบฉากสั้นก่อนแก้ทั้งเรื่องเมื่อ feedback พบปัญหาภาษา/การแสดงรุนแรง ใช้ feedback จริงเป็นหลัก ไม่ประกาศว่าคุณภาพผ่านด้วยคะแนนที่ผู้เขียนให้ตัวเอง

## Character visual development
เมื่อผู้ใช้ขอ สามารถสร้างภาพอ้างอิงตัวละครใน Creative ก่อนอนุมัติบทได้ โดยกำกับ PROPOSED/REVIEW และแยกจาก shot/video production
ตัวละครต้องมี visual identity ที่จดจำได้ทันที เช่นรูปทรงผม สีผมเฉพาะจุด เครื่องแต่งกายหรือ accessories ที่มีเหตุผล ไม่ใช้คำกว้างอย่างผมยาวดัดลอนเป็นรายละเอียดทั้งหมด
รักษาหน้าตา ทรงผม ด้านซ้าย/ขวา เสื้อผ้า และสัดส่วนตาม reference ที่เลือก บันทึกความคลาดเคลื่อนที่เห็นจริง และเก็บภาพไว้กับเรื่องนั้น
