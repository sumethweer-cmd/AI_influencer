# HANDOFF — ระบบตัดต่อละครแนวตั้ง "น้ำลดแล้ว…เธอจะไปไหม?"

เอกสารนี้สำหรับ Claude Code (และคน) บนเครื่องอื่นที่จะทำงานต่อจาก EP01 อ่านจบแล้วทำตามหัวข้อ **"เริ่มบนเครื่องใหม่"** ได้เลย
ทุกตัวเลขในเอกสารคือค่าที่ใช้จริงใน EP01 v2 (ดูที่ `drama_edit.py` ถ้าสงสัย โค้ดคือความจริงสูงสุด)

## 0. สถานะ (EP01 v2 เสร็จแล้ว)
- ผลลัพธ์: `<ep>\edit\EP01_v2.mp4` ยาว 2:31 1080x1920 24 fps ซับไทยฝังภาพ -14 LUFS / -1 dBTP
- ผู้ใช้ (Golf) รีวิวแล้วว่า "ใช้ได้" ยังไม่ได้ฟังมิกซ์เสียงทั้งตอนโดย Claude (Claude ฟังเสียงไม่ได้ ผู้ใช้ต้องฟังเอง)
- ยังไม่ได้ทำ: ใส่เสียง/เพลงบนการ์ดชื่อตอนและ ending (ตอนนี้เงียบ), ฟอนต์ไทยเฉพาะซีรีส์ (ตอนนี้ใช้ Leelawadee UI), แถบ WFH ยังดีไซน์ธรรมดา, บีบไฟล์ให้เล็กลง (217 MB ที่ crf 16)

## 1. โครงของคลิปที่ผู้ใช้เลือก (ห้ามเปลี่ยนโดยไม่ถาม)
`hook (highlight 2 ช็อต) → dissolve 0.3s → การ์ด EP.xx + ชื่อตอน (1.6s) → เนื้อเรื่อง (มีป้าย EP.xx มุมบน 3.4s ตอนเริ่ม) → dissolve 0.5s → end card (3.6s: กดไลก์ กดติดตาม ตอนต่อไป) → fade out 0.5s`
- ไม่มีโลโก้เปล่าๆ นำหน้า เพราะ 3 วินาทีแรกคือ hook (ผู้ใช้ตัดสินใจเอง)
- ผู้ใช้อยากได้งานง่าย: ตัดให้ดูดี transition เหมาะสม ซับไทย ไม่ต้อง motion อลังการ เพลงไม่ใช่เรื่องซีเรียส

## 2. เครื่องมือ
| ไฟล์ | หน้าที่ |
|---|---|
| `drama_edit.py` | ทั้ง pipeline: `transcribe` `plan` `highlights` `graphics` `render` (`all` = ทุกอย่างยกเว้น highlights) |
| `check_render.py` | ตรวจหลังเรนเดอร์: ความดังไฟล์จริง, ภาพรอยตัดทุกจุด, ภาพซับ 12 จุด, แถบต้น/ท้ายคลิป → PNG ใน `<ep>\edit\` |
| `graphics\ep-card.html` `end-card.html` `tag.html` | เทมเพลต HyperFrames (รับตัวแปรจาก `--variables-file`) pin เวอร์ชัน hyperframes **0.8.143** |
| `..\.claude\skills\drama-highlight-picker\SKILL.md` | เกณฑ์เลือก highlight ของ hook |
| `setup.ps1` | ติดตั้งสภาพแวดล้อมบนเครื่อง Windows ใหม่ |
| `examples\` | ตัวอย่างไฟล์ config ของ EP01 (`series.json`, `ep.json`) |

### โฟลเดอร์ข้อมูล (อยู่นอก git) ของ EP01
```
<series>\_series\series.json          ชื่อซีรีส์ / สี accent / headline ของ end card (ใช้ร่วมทุกตอน)
<series>\EPxx\vdo\EPxx-C01.mp4 ...     คลิปจาก MiniMax H3 (มีเสียงพูดฝังอยู่แล้ว)
<series>\EPxx\prompts\C01.txt ...      prompt ของแต่ละคลิป มี <d>[Thai] ...</d> = บทพูดที่ "สั่ง" ให้โมเดลพูด
<series>\EPxx\script.md                บท
<series>\EPxx\edit\ep.json             ค่าของตอนนี้ (ดู examples\ep.json)
<series>\EPxx\edit\work\               ไฟล์ทำงาน (whisper, plan.json, subs.ass, graph.txt, timeline.json) ลบ/สร้างใหม่ได้
<series>\EPxx\edit\EPxx_v2.mp4 .srt    ผลลัพธ์
```
path ของเครื่องนี้คือ `C:\vert drama\น้ำท่วม\EP01` เครื่องอื่นใช้ path ไหนก็ได้ แค่ส่ง `<ep_dir>` ให้สคริปต์

## 3. เริ่มบนเครื่องใหม่ (Windows)
1. `git pull` (หรือ clone) repo นี้
2. รัน `powershell -ExecutionPolicy Bypass -File video-editor\setup.ps1` มันจะ: เช็ก/ติดตั้ง ffmpeg (winget `Gyan.FFmpeg`), เช็ก Node 22+ และ Chrome, สร้าง `.venv` + `pip install faster-whisper numpy`, ก๊อปฟอนต์ Leelawadee UI จาก `C:\Windows\Fonts` เข้า `graphics\fonts`, รัน `hyperframes doctor` ครั้งแรก Whisper small จะโหลดโมเดล ~460 MB (ต้องใช้เน็ต)
3. สร้าง/เช็ก `_series\series.json` และ `EPxx\edit\ep.json` (ก๊อปจาก `examples\`)
4. ลำดับงาน (ทุกคำสั่ง `.venv\Scripts\python.exe -I drama_edit.py "<ep_dir>" <stage>`):
   1. `transcribe` — Whisper small CPU (~3 วิ ต่อคลิป 10 วิ) เก็บ cache ใน `edit\work\whisper`
   2. `plan` — จับบทกับเสียง, เลือกเทค, คำนวณ trim ดู log ว่าบรรทัดไหน `UNMATCHED` หรือ `(unrefined)`
   3. `highlights` — แสดงตัวเลือก hook เรียงคะแนน แล้วอ่านเกณฑ์ใน skill `drama-highlight-picker` เลือกเอง 2 อัน เขียนลง `ep.json` → `highlights`
   4. `graphics` — เรนเดอร์ การ์ดชื่อตอน / ป้าย hook / ป้าย main / end card ผ่าน HyperFrames
   5. `render` — เรนเดอร์ทั้งตอน (~2 นาที บน Ryzen 5) → `EPxx_v2.mp4`
   6. `check_render.py "<ep_dir>"` แล้วเปิด PNG ดูรอยตัด ซับ ต้นคลิป ท้ายคลิป ก่อนส่งให้ผู้ใช้
5. ส่งให้ผู้ใช้ดู รายงานว่าตรวจอะไรแล้ว **และอะไรตรวจไม่ได้** (ฟังเสียงไม่ได้) แก้ตามที่ติ แล้วเรนเดอร์ใหม่เฉพาะส่วนที่แก้ (override ใน `edit\work\overrides.json`)

### ตัวอย่างงานของตอนใหม่ (EP02)
ก๊อป `examples\ep.json` ไปที่ `EP02\edit\ep.json` แก้ `ep`, `title`, `scenes` (กลุ่มคลิปที่ถ่ายต่อเนื่องในฉากเดียวกัน ระหว่างกลุ่ม = dissolve), `alt_takes` (คลิปที่มี 2 เทค เช่น `"C10": ["C10a","C10b"]` เลือกเทคที่ตรงบทกว่า), `banners` (ข้อความบนจอ เช่นแจ้งเตือนมือถือ — ไม่ให้โมเดลเจนตัวอักษร), `highlights` (ว่างไว้ก่อนแล้วเลือกหลัง `plan`)

## 4. สเปกที่ใช้จริง (ต้องใช้ให้เหมือนกันทุกตอน)

### ภาพและเสียงออก
- 1080x1920, 24 fps, H.264 `libx264 -preset medium -crf 16 -pix_fmt yuv420p`, AAC 320k 48 kHz stereo, `-movflags +faststart`
- คลิปต้นฉบับ 832x1504 (บางคลิป 768x1376) → scale กว้าง 1080 (lanczos) แล้ว crop กลาง 1080x1920
- ความดัง: loudnorm 2 pass `I=-14 LUFS, TP=-1 dBTP, LRA=11, linear=true` (วัดจริงของ EP01 v2: -14.00 LUFS / -1.00 dBTP; คลิปดิบฟังดังประมาณ -10.7 LUFS true peak +0.2 จึงถูกลดลง)
- เสียงต่อคลิป: fade out 0.04 s ท้ายทุกคลิป, fade in 0.03 s ต้นคลิป (เว้นคลิปที่เริ่มพูดทันทีก่อน 0.12 s), final fade out 0.5 s ทั้งภาพและเสียง
- การ์ดไม่มีเสียง (anullsrc) — ยังไม่ได้ใส่เพลง/sting

### ตัดต่อ
- ภายในฉากเดียวกัน = hard cut (ต่อ handoff pose ที่ prompt ออกแบบไว้)
- dissolve (xfade fade + acrossfade): ระหว่างฉาก 0.3 s (EP01: C05→C06, C10→C11), hook→การ์ด 0.3 s, เนื้อเรื่อง→end card 0.5 s
- ตัดท้ายคลิป: `out = min(ความยาวจริง, max(planned_end ใน prompt + 0.15, เสียงพูดสุดท้ายจบ + 0.45))`; ต้นคลิปไม่ตัด (มีท่าทางที่ต้องเก็บ)
- เทคสำรอง: เลือกเทคที่ตัวอักษรที่ Whisper ฟังได้ใกล้บทมากกว่า (ผูกด้วยคะแนนถ่วงน้ำหนักตามความยาว) เสมอกัน → เทคหลัง (ตัวอักษรหลังสุด)

### ซับไทย (burn-in ด้วย libass)
- ฟอนต์ **Leelawadee UI Bold** (`LeelaUIb.ttf`; ใส่ `LeelawUI.ttf` ไว้ด้วย) ในโฟลเดอร์ `edit\work\fonts`, ฟอนต์ตระกูลชื่อ `Leelawadee UI`
- ขนาด **64 px** บนผืน 1080x1920 (PlayRes ตรงกับพิกเซล), ขอบดำ outline **5**, shadow **1**, Alignment 2 (กลางล่าง), MarginV **235** → อยู่ในเศษหนึ่งส่วนห้าล่างของจอ (กฎ "เว้นล่างไว้ให้ซับ" ของ skill vertical-drama-director)
- สี: มีนา = ขาว `&H00FFFFFF`; ธนา = เหลืองอ่อน `&H0080E0FF` (ASS เป็น BGR = RGB #FFE080)
- ข้อความ = บทใน prompt (ไม่ใช่สิ่งที่ Whisper ฟังได้) `…` เปลี่ยนเป็น `...`; บรรทัดที่มี `…` คั่นระหว่างท่อนยาว ≥ 4 ตัวอักษร จะแตกเป็นหลายซับ ท่อนสั้นกว่า 4 ติดกับท่อนข้างเคียง
- เวลาซับ: เริ่ม = เริ่มพูดจริง − 0.06 s, จบ = จบพูดจริง + 0.22 s (ไม่เกินเริ่มของบรรทัดถัดไป − 0.09 s), อย่างน้อย 0.9 s, ไม่เกินท้ายช็อต
- แถบแจ้งเตือนบนจอ (ใช้กับ "ประกาศ WFH" ที่ C11): สไตล์ `Notif` ขนาด **50 px** ตัวหนา สีตัวอักษร #202020 กล่องสี #F2F2F2 (BorderStyle 3, outline 26), Alignment 8 (กลางบน) MarginV **80**, เริ่ม 3.0 s ในคลิป C11 ยาว 3.2 s fade 250 ms ทั้งเข้าออก; ข้อความ "วันนี้ให้ทุกคนทำงานจากบ้านนะคะ\Nเนื่องจากฝนและน้ำท่วมขัง" (ไม่ให้โมเดลเจนตัวอักษร ตามกฎของ skill director)

### กราฟิก HyperFrames (1080x1920, 24 fps)
- สี: accent เหลือง `#FFC933` (เลียนขอบเหลืองของบูท), พื้นหลังน้ำเงินเข้ม gradient `#12304a → #0a1a2c → #060d17`, ตัวหนังสือขาว `#f3f6fa`; ฟอนต์ Leelawadee UI Bold (`@font-face` ไปที่ `fonts/LeelaUIb.ttf`)
- **การ์ดชื่อตอน** (`ep-card.html`, 1.6 s): ชื่อซีรีส์ 44 px (ขาว 78%) → "EP.01" 270 px สี accent ขึ้นทีละตัวอักษรจากล่าง (back.out, stagger 0.07) → เส้น 460x8 px ขยายจากกลาง → ชื่อตอน 76 px แยกคำขึ้นทีละคำ; ฝนตก 22 เส้น (ตำแหน่งคงที่ ไม่ใช้ random)
- **ป้ายข้อความ** (`tag.html`, 3.4 s, โปร่งใส → WebM) ซ้ายบน (left 64, top 140) แท่ง accent กว้าง 10 + ข้อความ เงาข้อความเพื่ออ่านออกบนภาพ: layout `series` (hook): ชื่อซีรีส์ 54 px + "EP.01" 40 px สี accent; layout `episode` (เนื้อเรื่อง): "EP.01" 120 px สี accent + ชื่อตอน 50 px ขาว; ออกที่ 3.0 s เลื่อนซ้าย 60 px จางหาย; ป้าย hook เริ่มที่ 0.25 s ของคลิป, ป้าย main เริ่ม 0.4 s หลังเนื้อเรื่องเริ่ม
- **End card** (`end-card.html`, 3.6 s): ภาพปก = เฟรมจากคลิปสุดท้ายที่ (จุดจบคลิป − 0.45 s) หรือรูปที่ระบุใน `ep.json.cover`; ภาพซูมช้า 1.00→1.07; ชื่อซีรีส์ 46 px บน; headline "ชอบตอนนี้ไหม?" 100 px; ปุ่ม "กดไลก์" (พื้น accent ตัวสีเข้ม) กับ "กดติดตาม" (ขอบขาว) 56 px; "ตอนต่อไป EP.02 เร็วๆ นี้" 46 px
- ภาพซ้อนป้ายด้วย ffmpeg: ต้อง `-c:v libvpx-vp9` ก่อน `-i` ของ WebM (decoder เนทีฟของ ffmpeg ทิ้งอัลฟา)

### Hook (highlight) — กฎอยู่ใน skill
2 ช็อต รวม ~4.5 s (EP01: C03 "เห็นชุดฉันแล้ว…ดำน้ำเหรอ" + C10b "หน้าแดง/ร้อน!"), เผื่อหัว/ท้ายช็อต 0.3 s จากช่วงเสียงพูดจริง ห้ามใช้มุกปิดตอน ("…ซื้อข้าว") ห้ามใส่เพลง/เสียงพากย์เพิ่ม

## 5. บทเรียนที่ต้องรู้ (เจอจริงแล้ว ไม่ต้องเจออีก)
1. **Whisper ฟังไทยผิดบ่อย และเวลาของมันคลาดได้ถึง ~2 วินาที** (เริ่มเร็วเกิน) ดังนั้น: ข้อความซับมาจาก prompt เสมอ; Whisper ใช้แค่หาตำแหน่งคร่าวๆ แล้ว snap เข้ากับ **Silero VAD** (`faster_whisper.vad.get_speech_timestamps`, threshold 0.5, min speech 120 ms, min silence 120 ms, pad 20 ms) ผลตรงกับกราฟระดับเสียงจริง
2. Alignment = DP รักษาลำดับ (ดู `align()`), `max_win=60` คำ (คำไทยของ Whisper แตกละเอียด หน้าต่างเล็กจะตัดหัวประโยค)
3. คลิปจาก MiniMax **มีเสียงพูดฝังอยู่แล้ว** (skill director เก่าบอกว่าไม่มี — ไม่จริงสำหรับชุดนี้); ระดับเสียงดิบดังและมี true peak เกิน 0 dB
4. ความยาวคลิปจริงมักเกิน `planned_end` ใน prompt; บางคลิปพูดนอกช่วงที่แผนไว้ (เช่น C05 พูดตอน 10 s ทั้งที่แผนจบ 8.5 s) จึงต้องคุมด้วยเสียงพูดสุดท้าย + 0.45 s
5. `python -I` **ไม่อ่านตัวแปร `PYTHONIOENCODING`** → สคริปต์เรียก `sys.stdout.reconfigure(encoding="utf-8")` เอง; อ่านล็อกไทยผ่านไฟล์ UTF-8
6. ffmpeg 9: ไม่มี `-filter_complex_script` ใช้ `-/filter_complex <file>` (รันด้วย `cwd=edit\work` และ path แบบ relative `subs.ass`, `fontsdir=fonts` เพื่อเลี่ยงปัญหา escape ของ `C:`)
7. PowerShell กลืนเครื่องหมายคำพูดใน JSON ที่ส่งทาง argument → ใช้ `--variables-file` เสมอ (สคริปต์ทำให้แล้ว)
8. HyperFrames ต้องเห็น ffmpeg ใน PATH (สคริปต์เติมให้) และใช้ Chrome ของระบบ (ไม่ต้องโหลดเพิ่ม); เครื่อง RAM น้อย ใช้ `--workers 1`
9. คำเตือน `Fontconfig error: Cannot load default config file` จาก ffmpeg ไม่เป็นไร (ซับยังแสดงถูก)
10. ฟอนต์ Leelawadee UI เป็นของ Microsoft **ห้าม commit** (อยู่ใน .gitignore) ให้ก๊อปจาก `C:\Windows\Fonts` (setup.ps1 ทำให้)
11. HyperFrames init ติดตั้ง skills ของมันไว้ที่ `~\.claude\skills` และ `~\.agents\skills` (ใช้ได้ทุกโปรเจกต์) และปิด telemetry แล้วด้วย `hyperframes telemetry disable`
12. ถ้ามีหลายเครื่อง ความจำของ Claude Code ไม่ซิงก์ — ทุกอย่างสำคัญต้องอยู่ในไฟล์นี้หรือใน repo

## 6. ข้อจำกัด (พูดความจริงกับผู้ใช้เสมอ)
- Claude ดูวิดีโอไม่ได้ ได้แค่ภาพนิ่งที่ดึงออกมาและกราฟเสียง; ฟังเสียงไม่ได้ → ผู้ใช้ต้องฟังมิกซ์ก่อนโพสต์, ความเป็นธรรมชาติของจังหวะตัดต่อวัดไม่ได้
- ตรวจแล้วใน EP01: ความดัง/true peak ของไฟล์จริง, ภาพก่อน-หลังทุกรอยตัด, ซับ 12 จุดเทียบปากตัวละคร, ฟอนต์ไทย (สระ/วรรณยุกต์) ในซับ/การ์ด, ป้ายโปร่งใส
- ไม่ได้ตรวจ: เสียงรอยต่อ (click/ambience ที่สะดุด), เสียงช่วง dissolve, ความสวยของกราฟิกในมุมมองผู้ชมจริง

## 7. ไอเดียต่อยอดที่ผู้ใช้อาจขอ
ใส่เสียง sting/ambience ฝนบนการ์ด · ฟอนต์ไทยเฉพาะซีรีส์ (ต้องขออนุญาตดาวน์โหลดก่อน) · บีบไฟล์ (crf 20 ≈ ครึ่งหนึ่ง) · ใส่เพลงประกอบ (มีไฟล์ mp3 3 ไฟล์ใน `น้ำท่วม\` ถามก่อนว่าใช้ได้) · ปรับดีไซน์แถบแจ้งเตือน WFH · แปลงให้รันบน Mac/Linux (ต้องแก้ path ฟอนต์ `C:/Windows/Fonts`, การหา ffmpeg, `cmd /c npx`)
