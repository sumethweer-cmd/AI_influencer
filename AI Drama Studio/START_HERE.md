# START HERE — ทำงานต่อจากอีกเครื่อง (Claude Code อ่านไฟล์นี้ก่อน)

เป้าหมาย: เครื่องใหม่ที่ clone repo นี้ ให้ Claude Code อ่าน skill แล้วใช้ **prompt ที่เตรียมไว้แล้ว** สั่งเจนวิดีโอต่อบน RunPod/ComfyUI ได้ โดยไม่ต้องมีประวัติแชตเดิม

## 0. สถานะงาน (อ่านก่อน)
`05_Production/short-parking-001/PRODUCTION_STATUS.md` — คลิปไหนเจนแล้ว/เวอร์ชันไหนใช้/ปัญหาที่รู้/ข้อที่ผู้ใช้ยังต้องตัดสิน
ผลลัพธ์วิดีโอ **ไม่ได้เก็บใน repo** (อยู่ในเครื่องต้นทาง `05_Production/short-parking-001/outputs/`) เครื่องใหม่จะไม่มีคลิปเดิม — สั่งเจนเฉพาะที่ต้องการด้วย `--only`

## 1. เตรียมเครื่อง (ครั้งเดียว)
- ติดตั้ง **Node.js 18+** (สคริปต์ไม่มี dependency เพิ่ม) · ติดตั้ง **ffmpeg** ถ้าอยากให้ Claude ตรวจคลิป (ไม่บังคับ)
- clone repo แล้วใช้ branch ที่มีไฟล์ชุดนี้ (`drama-studio/short-parking-001` หรือ main ถ้า merge แล้ว):
  `git clone https://github.com/sumethweer-cmd/AI_influencer.git` → `git switch drama-studio/short-parking-001`
- เปิด Claude Code **ที่โฟลเดอร์รากของ repo** (skills อยู่ที่ `.claude/skills/` จะโหลดอัตโนมัติ)
- (ถ้าอยากให้ Claude ปิด pod ให้) ตั้ง env `RUNPOD_API_KEY` ในเครื่องนั้น — **ห้ามวางคีย์ในแชตหรือไฟล์ใน repo**

## 2. ทุกครั้งที่จะเจน
1. เปิด pod บน RunPod (ติด **network volume เดิม** ที่มี ComfyUI + โมเดล MiniMax H3 + workflow เดิม) ให้ ComfyUI พร้อมใช้ (โหลด workflow ได้ ไม่มี node แดง)
2. copy **ComfyUI URL** ของ pod: `https://<pod-id>-8188.proxy.runpod.net` (มี `#...` ต่อท้ายได้)
3. พิมพ์สั่ง Claude Code เช่น:
   > อ่าน skill `drama-h3-production` และ `comfyui-runpod-batch` แล้วอ่าน `AI Drama Studio/05_Production/short-parking-001/PRODUCTION_STATUS.md` จากนั้นเจน segment P05 และ P06 ใหม่บน pod นี้: `<URL>`
4. Claude จะ: เช็ก pod (`--check`) → dry-run → **ถามยืนยันก่อนส่งงาน** → ส่งเข้าคิว → รอ → ดาวน์โหลดลง `outputs/` → รายงานผล
5. เสร็จแล้วสั่งปิด pod (กดเอง หรือให้ Claude ใช้ `runpod_pod.mjs` ถ้าตั้ง `RUNPOD_API_KEY` ไว้)

## 3. ข้อควรระวังเมื่อเปลี่ยนเครื่อง
- **Workflow ต้องเป็นตัวเดิม** (MiniMax H3 Ref2VA ที่มี node ตามกราฟใน `tools/workflow_api_template.json`) — ถ้าแก้ workflow ให้ Claude ดึงกราฟใหม่จาก `/history` แล้วตรวจเลข node ใน `batch.config.json` (อ่านวิธีใน skill `comfyui-runpod-batch`)
- รูปอ้างอิงตัวละคร 3 รูปอยู่ใน repo (`04_Series/short-parking-001/References/Characters/`) สคริปต์อัปโหลดขึ้น pod ให้เอง ไม่ต้องทำเอง
- เส้นทางไฟล์ใน skill ที่เขียนว่า `ai_influencer/model_specs/minimax-h3.md` = `model_specs/minimax-h3.md` ใน repo นี้ (รากของ repo คือ ai_influencer อยู่แล้ว)
- Prompt ทุกไฟล์ติดป้าย DIRECTOR DRAFT — บท v0.4 ยังเป็น REVIEW ไม่มีบันทึกอนุมัติ
- ก่อนสั่งงานทุกครั้ง Claude ต้องบอกจำนวนงาน/เวลา/ค่าใช้จ่ายโดยประมาณและขออนุญาตก่อน (กฎใน skill)
- อ้างอิงเวลา: ~5 นาที/คลิป 15 วินาที ที่ 1 MP บน RTX 5090 (≈ 1.2 USD/ชม.)
