# Brief: teardown คลิป "AI OFM" (rY_GxSPiQa4)

> เอกสารนี้เขียนไว้ให้ Claude Code ที่รันบนเครื่อง local อ่านแล้วทำงานต่อได้เลย
> (session บน cloud เข้า YouTube ไม่ได้ — โดน network egress policy block)

## แหล่งข้อมูล

- **ลิงก์ต้นทาง:** https://www.youtube.com/watch?v=rY_GxSPiQa4
- **ไฟล์ที่โหลดไว้แล้ว (Windows):**
  `C:\AI Content\YTDown.com_YouTube_AI-OFM-make-the-best-videos-with-only-8-_Media_rY_GxSPiQa4_001_1080p.mp4`
- **ชื่อคลิป (จากชื่อไฟล์ — โดนตัด):** `AI OFM - make the best videos with only 8...`
  → ต้องยืนยันจากตัวคลิปว่า "only 8" คืออะไร (8GB VRAM / $8 / 8 seconds / 8 minutes)
  แต่ละอันหมายถึง "เครื่อง" คนละแบบกันสิ้นเชิง
- **OFM** = OnlyFans Management — ตรง niche กับ repo นี้

## สิ่งที่ต้องการ 2 ส่วน (แยกกันชัดเจน)

### A. "เครื่อง" — tooling / workflow teardown
เป้าหมายคือ **copy เครื่องมือเขามาใช้ใน repo นี้** ต้องได้:
1. **Stack ที่เขาใช้จริง** — ทุก tool/model/service ที่โผล่บนหน้าจอ หรือถูกพูดถึง
   (ComfyUI? node อะไรบ้าง? checkpoint/LoRA ตัวไหน? video model อะไร? TTS? upscaler? face swap?)
2. **ลำดับการต่อ pipeline** — input อะไร → ผ่านอะไร → ออกมาเป็นอะไร วาดเป็น flow
3. **ตัวเลขจริง** — VRAM, เวลา render ต่อชิ้น, ต้นทุนต่อคลิป, resolution, ความยาวคลิป
4. **ท่าที่เป็น "ของจริง"** — trick/setting ที่ทำให้ผลลัพธ์ดีกว่าชาวบ้าน (นี่คือขุมทรัพย์)
5. **Gap analysis** — เทียบกับ `.claude/skills/ai-content-pipeline/SKILL.md` ที่มีอยู่:
   อะไรที่เรามีแล้ว / อะไรที่เขามีแต่เราไม่มี / อะไรที่ควร copy มาก่อนเป็นอันดับแรก

### B. "แนวทาง content" — content strategy teardown
1. **Mechanic ของคลิปตัวนี้เอง** — hook 5 วินาทีแรก, โครงคลิป, จังหวะ, ending
2. **แนวทาง content ที่เขา "สอน"** — เขาบอกให้ทำ content แบบไหน โพสต์ยังไง แพลตฟอร์มไหน
3. **Map ลง persona ที่เรามี** — `personas/m0m0.md` และ `personas/tina.md`
   อันไหนใช้ได้เลย / ต้องปรับ pillar หรือ posting rhythm ตรงไหน

## ข้อควรระวัง — คลิปนี้ไม่ใช่ reel สั้น

`reel-intake` ออกแบบมาสำหรับ reel 15–60 วิ แต่อันนี้เป็นคลิป YouTube ยาว (น่าจะ 8+ นาที)
ต้องปรับวิธี:
- 1 fps × 8 นาที = ~480 เฟรม → contact sheet 4×4 จะได้ ~30 แผ่น
- **ใช้ contact sheet เพื่อ "สแกนหา" ช่วงที่แชร์หน้าจอ** ก่อน แล้วค่อยเปิดเฟรมเดี่ยวความละเอียดเต็มเฉพาะช่วงนั้น
- ช่วงที่เป็นหน้าคนพูดอย่างเดียว ข้ามได้ — ใช้ transcript พอ
- ถ้าอ่าน UI ในเฟรมไม่ออก ให้ crop + upscale เฉพาะจุด อย่าเดาชื่อ node/setting

## กติกา

- **ห้ามเดา** ชื่อ tool / node / ตัวเลข — ถ้าอ่านไม่ออกให้เขียนว่า "อ่านไม่ออก ต้องดูซ้ำที่วินาทีที่ N"
- คลิปนี้เป็น **reference สำหรับเรียนรู้ format และ workflow** ไม่ใช่เอาไฟล์เขาไปโพสต์ซ้ำ
  ไม่ copy หน้า/ชื่อ/สคริปต์ของเขา — เอาแค่วิธีการ

## Output

เขียนลง `intake/2026-08-18-ai-ofm/`:

```
reference.mp4          # ไฟล์ต้นฉบับ
frames/                # เฟรม 1 fps
contact-sheet*.jpg     # แผ่นสแกน
transcript.txt         # + words.json ถ้า whisper ทำงาน
teardown.md            # ← ตัวหลัก: ส่วน A + ส่วน B ตามหัวข้อข้างบน
```

จบแล้ว commit + push ขึ้น branch `claude/youtube-treasure-content-ideas-hd3y6e`
(`intake/` อาจโดน .gitignore — ถ้าไฟล์ใหญ่ ให้ commit เฉพาะ `teardown.md` + `transcript.txt` + contact sheet พอ)

## หมายเหตุเรื่อง environment

- **local (Windows):** yt-dlp + whisper ทำงานได้ครบ ใช้ Git Bash รัน `.sh` ได้
  (`"C:\Program Files\Git\bin\bash.exe" .claude/skills/reel-intake/scripts/...`)
- **cloud session:** ffmpeg ใช้ได้ (ติดตั้งผ่าน `pip install imageio-ffmpeg`)
  แต่ whisper โหลด model ไม่ได้ (huggingface.co / openaipublic โดน block) และเข้า youtube.com ไม่ได้
