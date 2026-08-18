# Teardown — "AI OFM: make the best videos with only 8 clicks"

- **ที่มา:** https://www.youtube.com/watch?v=rY_GxSPiQa4 · ความยาว ~17 นาที
- **ฐานข้อมูลที่ใช้วิเคราะห์:** transcript แบบมี timestamp (ยังไม่ได้ดูภาพ — ดู "ช่องว่าง" ท้ายเอกสาร)
- **"only 8" = 8 clicks** — ยืนยันที่ 13:09 ("it takes eight clicks now to create a insanely high quality reel")
- **OFM** = OnlyFans Management · ช่องขนาดเล็ก (~180 subs ตอนถ่าย) · หารายได้ผ่าน referral ของ Fanvue / NewFans

---

# ส่วน A — "เครื่อง" ของเขา

## A.1 มันคืออะไร

**"Reel Studio"** — web app รันบนเครื่องตัวเอง (localhost) ที่เขาสร้างเองใน 3 เดือน
วิธีติดตั้ง: เอา **prompt ก้อนใหญ่มากๆ ก้อนเดียว** ไปวางใน **Claude Code** (เปิดผ่าน PowerShell)
แล้ว Claude จัดการ setup ให้ทั้งหมด — สแกน dependency, บอกว่าต้องโหลดอะไร, พาไล่ทีละขั้น

> ตัวสินค้าที่เขาแจก **ไม่ใช่โค้ด แต่เป็น prompt** (ลิงก์อยู่ใต้คลิป) — นี่เป็น distribution model ที่น่าสนใจในตัวเอง

setup wizard มี checklist ที่ต้องขึ้นเขียวครบ + ช่องใส่ API key

## A.2 Core mechanic — จุดที่เป็นขุมทรัพย์จริง

**เขาไม่ได้ generate วิดีโอจาก text. เขาขโมย "การเคลื่อนไหว" จาก TikTok ของคนจริงที่ไวรัลแล้ว มาสวมทับ persona ตัวเอง**

```
TikTok ที่ไวรัลแล้ว (คนจริงเต้น/ขยับ)
        │
        ├─ เป็น motion reference
        ▼
persona image ของเรา  ──►  Kling  ──►  Reel ที่ persona เราขยับเหมือนคนจริงเป๊ะ
```

ทำไมถึงเก่ง — เขาอธิบายเองในช่วง 0:30–2:40 ว่าปัญหาไม่ใช่ยอดวิว แต่คือ **uncanny valley**:
คนดูกลุ่มเป้าหมาย (ผู้ชายอายุ 40+ ที่ไม่รู้จัก AI) ไม่ได้จับได้ว่าเป็น AI — แต่ "รู้สึกแปลกๆ"
จากการขยับมือที่ผิดธรรมชาติ แล้วความรู้สึกนั้นทำให้ไม่กดสมัคร

การเอา motion ของมนุษย์จริงมาใช้ ตัดปัญหานี้ทิ้งที่ต้นทาง — ได้ physics จริง + format ที่พิสูจน์แล้วว่าไวรัล **พร้อมกัน**

## A.3 Stack ที่จับได้จาก transcript

| ชั้น | เครื่องมือ | หมายเหตุ |
|---|---|---|
| Setup / codegen | **Claude Code** (ผ่าน PowerShell) | prompt ก้อนเดียวสร้างทั้งแอป |
| สร้าง persona | **Higgsfield** (ในคลิปออกเสียง "Hixit"/"X") | ทำนอกแอป reuse ของเดิมได้ |
| Source material | **TikTok downloader** (ไม่มีลายน้ำ) | ลิงก์ใต้คลิป · แอป auto-scan โฟลเดอร์ Downloads |
| VLM วิเคราะห์ท่า | **Qwen ~2.5-VL ผ่าน Ollama** (พูดว่า "Quinn 2.4") | รันในเครื่อง ไม่มีค่า API |
| Image gen | **Higgsfield + Nano Banana** | Nano Banana = Gemini image model |
| Video gen | **Kling** | คิดเป็นเครดิต · เห็นยอดเครดิตมุมบน · 1 คลิป = 1 เครดิต |
| Upload | Instagram + TikTok auto-uploader | login ค้างไว้ในแอป |

## A.4 Flow ในแอป

```
Downloads folder ──auto-scan──► INBOX ──เลือกคลิป──► ตั้งค่า ──► QUEUE
                                                                    │
                                                  ┌─────────────────┴──────────────┐
                                            [โหมด 1]                          [โหมด 2]
                                       straight to Kling              steal the first frame
                                    persona image + วิดีโอ            ↓
                                              │              screenshot เฟรมแรก
                                              │                      ↓
                                              │              Qwen-VL อ่าน: ท่ายืน สายตา ชุด
                                              │                      ↓
                                              │              สร้าง prompt → Higgsfield + Nano Banana
                                              │                      ↓
                                              │              ได้ภาพ persona เราในท่าเดียวกันเป๊ะ
                                              │                      ↓
                                              │              ⛔ IMAGE CHECK — approve / retry / cancel
                                              └──────────────────────┤
                                                                     ▼
                                                                  KLING
                                                                     ▼
                                                          REVIEW — approve / back / reject
                                                                     ▼
                                                         PERFORMANCE (ตั้งเวลาโพสต์)
                                                                     ▼
                                                          auto-upload IG + TikTok
```

**ทำไม image-check gate สำคัญ:** เป็นด่านกันเงินไหลทิ้ง — เช็คภาพนิ่งให้ผ่านก่อน ค่อยจ่ายเครดิต Kling
โหมด 2 ยังทำให้เฟรมแรกของเรา *ตรงท่า* กับเฟรมแรกของ source ด้วย ซึ่งเป็นสาเหตุที่ motion transfer ออกมาดี

## A.5 ตัวเลข / setting ที่เขาบอกเอง

| ค่า | ที่เขาบอก | เวลา |
|---|---|---|
| เวลาทำ 1 reel | เดิม 45 นาที → เหลือ **8 คลิก** | 3:12, 13:09 |
| ความยาวคลิปที่เวิร์กสุด | **7 วินาที** | 14:32 |
| ความยาวคลิป auto-cut | ตัดตามความยาว source อัตโนมัติ ไม่ generate ทิ้ง | 7:18 |
| โพสต์สูงสุด/วัน | 4 | 9:45 |
| ระยะห่างระหว่างโพสต์ | ต่ำสุด 10 นาที สูงสุด 30 นาที | 9:36 |
| ต้นทุน | 1 เครดิต Kling / คลิป | 15:01 |
| Camera movement toggle | ซ้าย = ก๊อป camera movement ด้วย · **ขวา = จับเฉพาะการขยับของคน → คุณภาพสูงกว่า** | 8:05–8:23 |
| Prompt field | แก้ได้ แต่เขาแนะนำ **อย่าแก้** ค่า default เวิร์กสุด | 7:43, 8:25 |

## A.6 ระบบ "เรียนรู้เวลาโพสต์"

โหมดเวลาอัปโหลด 3 แบบ: standard / specific / **random**
โหมด random คือโหมดเก็บ data → เขาอ้างว่าหลัง 30 วันจะรู้เวลาที่ดีที่สุดแล้วตั้งเวลาให้เอง
Performance tab มี heat map ยอดวิวรายวัน + ดึงยอดวิวจริงกลับมา

> ⚠️ **ตรงนี้คือจุดอ่อนที่สุดของแอปเขา — อย่าเอามาเป็นอันดับต้นๆ**
> ตอนถ่ายคลิป ระบบมีข้อมูลแค่ **13 โพสต์ / 19 วัน** แล้วบอกว่าอีก 13 วันจะสรุปได้ว่าเวลาไหนดีที่สุด
> 13 จุดข้อมูลกระจายบน 24 ชั่วโมง สรุปอะไรทางสถิติไม่ได้เลย และ IG reach ผันผวนกว่าผลของเวลาโพสต์หลายเท่า
> feature นี้ *ฟังดูดี* มากกว่า *ใช้ได้จริง*

---

# ส่วน B — แนวทาง content

## B.1 Thesis หลักของเขา

> ปัญหาเดียวคือ **คุณภาพ** — ไม่ใช่ shadowban ไม่ใช่ bio ไม่ใช่ caption ไม่ใช่แฮชแท็ก

เขาแยกอาการเป็น 2 แบบ แล้วเคลมว่ามาจากรากเดียวกัน:
1. **โพสต์ทุกวันแต่ค้างที่ 100–200 วิว** → คลิปไม่ดีพอ อัลกอไม่ดัน
2. **มีวิว 1–2k แต่ไม่มีคนสมัคร** → คลิป "รู้สึกแปลกๆ" คนดูไม่กล้ากดจ่าย

ข้อ 2 คือ insight ที่คนส่วนใหญ่มองข้าม และเป็นเหตุผลทั้งหมดที่เขาสร้างแอปนี้

## B.2 Persona ของคนดู — ใช้ได้จริงมาก

เขาสมมติคนดูเป็นตัวละครชื่อเดียวชัดๆ ("ผู้ชาย 46 ปี ไม่รู้จัก AI") แล้วตัดสินใจทุกอย่างจากมุมคนคนนี้
วิธีนี้ทำให้เถียงเรื่อง design ได้จบเร็ว — คำถามเปลี่ยนจาก "สวยไหม" เป็น "คนนี้จะรู้สึกแปลกไหม"

**เอาไปใช้กับ `personas/m0m0.md` และ `personas/tina.md` ได้ทันที** — ตอนนี้ persona file
นิยาม *ตัวโมเดล* ละเอียดมาก แต่ไม่มีบล็อกไหนนิยาม *คนดู* เลย ควรเพิ่ม `audience_persona` เข้าไป

## B.3 โครงคลิป (คลิปนี้เอง)

| ช่วง | สิ่งที่ทำ |
|---|---|
| 0:00–0:30 | Hook แบบ "เลือกความเจ็บของคุณ" — ยิงปัญหา 2 ข้อ ให้คนดูทาบตัวเอง |
| 0:30–2:55 | ขยี้ปัญหา ผ่านตัวละครคนดูที่ตั้งชื่อไว้ ทำให้ปัญหาเป็นรูปธรรม |
| 2:55–3:40 | เฉลยว่า "ทางออกเดียว" คือของที่เขาสร้าง |
| 3:40–13:00 | เดโมสด ทำจริงให้ดูตั้งแต่ต้นจนจบ (ยาวมาก แต่คือ proof) |
| 11:26–11:54 | ขอ subscribe + referral — วางกลางคลิป ไม่ใช่ท้าย |
| 13:00–16:50 | เฉลยฟีเจอร์ลึกที่กั๊กไว้ (โหมด steal-first-frame) |
| 16:50–17:09 | ปิดด้วยลิงก์ใต้คลิป |

จุดที่น่าก๊อป: **กั๊กฟีเจอร์ที่เจ๋งที่สุดไว้หลังนาทีที่ 13** — คนที่ดูถึงตรงนั้นคือคนที่จะกดลิงก์จริง

## B.4 กลยุทธ์โพสต์ที่อ่านออกจากแอป

- **ปริมาณ:** 4 โพสต์/วัน ห่างกัน 10–30 นาที · generate ทีเดียว 20 คลิปแล้วให้ระบบทยอยปล่อยข้ามวัน
- **ความยาว:** 7 วินาที
- **แหล่งไอเดีย:** ไม่ต้องคิดเอง — ไปหยิบ TikTok ที่ไวรัลแล้วมาเป็นโครง
- **ช่องทาง:** IG + TikTok ยิงพร้อมกัน · ปลายทางคือ Fanvue / OnlyFans

---

# ส่วน C — Gap analysis เทียบกับ repo นี้

## C.1 ของที่เรามีอยู่แล้ว และเขาก็มี

| ความสามารถ | ของเรา | สถานะ |
|---|---|---|
| Persona เป็น source of truth | `personas/*.md` + ตาราง `ai_personas` | ✅ **ของเราละเอียดกว่าเขาเยอะ** (identity block ล็อกคำ, trigger word, negative baseline) |
| Image generation | `lib/comfyui.ts` + `lib/runpod.ts` | ✅ มี |
| Video generation | `jobs/video-generator.ts` (image → video ผ่าน ComfyUI) | ✅ มี |
| Job queue | ตาราง `production_jobs` + `jobs/production-runner.ts` | ✅ มี |
| Approval gate | `jobs/qc-manager.ts` + `app/api/jobs/approve-content` | ✅ มี |
| Scheduler | `jobs/scheduler.ts` + ตาราง `schedules` | ⚠️ มีโครง แต่ **ตัวโพสต์จริงยังเป็น placeholder** (`Math.random()` ปลอม URL) |
| เก็บ engagement | ตาราง `engagement_logs` (likes/comments/impressions/reach) | ⚠️ ตารางมี แต่ยังไม่มีตัวเติมข้อมูล |
| VLM | `lib/gemini.ts` | ✅ มี — **ใช้แทน Ollama+Qwen ของเขาได้เลย** |
| Scraping | `lib/apify.ts` | ⚠️ ยังเป็น mock data |

## C.2 ของที่เขามี เราไม่มี — เรียงตามความสำคัญ

### 🥇 1. Motion reference layer — ไม่มีเลย และนี่คือทั้งหมดของเรื่อง
ตอนนี้ `jobs/video-generator.ts` ทำ **image → video** เฉยๆ คือปล่อยให้โมเดลคิดท่าเอง
= สร้าง uncanny valley ที่เขาพูดถึงตรงๆ
สิ่งที่ขาดคือ **image + วิดีโออ้างอิง → video** (motion transfer)

### 🥈 2. Pose matching ด้วย VLM ก่อนสร้างภาพ
ยังไม่มีขั้นตอน "อ่านเฟรมแรกของ reference แล้วสร้าง prompt ให้ persona ยืนท่าเดียวกัน"
ทำได้ทันทีด้วย `lib/gemini.ts` ที่มีอยู่

### 🥉 3. Inbox — ท่อรับ reference material
ไม่มีที่ทางให้ "วิดีโออ้างอิง" ในระบบเลย ไม่มีตาราง ไม่มีโฟลเดอร์ ไม่มี UI
`.claude/skills/reel-intake` วิเคราะห์ reel ได้ แต่ผลลัพธ์ไม่ได้ไหลเข้า pipeline การผลิต

### 4. ตัวโพสต์จริง (IG / TikTok)
`jobs/scheduler.ts` ยัง fake อยู่ · ตาราง `schedules` default platform เป็น `twitter` ไม่ใช่ IG/TikTok

### 5. ดึงยอดวิวกลับมา + heat map
`engagement_logs` ว่างเปล่า ไม่มีอะไรเขียนลงไป

### ❌ ไม่ต้องรีบก๊อป — ระบบเรียนรู้เวลาโพสต์
เหตุผลอยู่ใน A.6 · ค่อยทำตอนมีข้อมูลหลักร้อยโพสต์

## C.3 ของที่เรามี แต่เขาไม่มี — จุดที่เราเหนือกว่า

1. **เราไม่ต้องจ่ายต่อคลิป** — เขาเผาเครดิต Kling ทุกคลิป (1 เครดิต × 4 โพสต์/วัน × 30 วัน)
   เรามี ComfyUI + RunPod อยู่แล้ว → ต้นทุนส่วนเพิ่มเกือบเป็นศูนย์ **นี่คือข้อได้เปรียบเชิงโครงสร้าง ไม่ใช่แค่ประหยัด**
   ถ้าเราทำ motion transfer ได้ เราจะ generate ได้มากกว่าเขาหลายสิบเท่าที่ต้นทุนเท่ากัน
2. **Persona system ของเราแข็งแรงกว่ามาก** — identity block ล็อกคำ, consistency ข้าม shot, SFW/NSFW pillars แยกกัน
   ของเขาคือ "รูป persona ในโฟลเดอร์" เฉยๆ
3. **มี DB จริง** — เขาเก็บทุกอย่างในโฟลเดอร์ในเครื่อง เราต่อ Supabase ไว้แล้ว
4. **กฎ "amateur iPhone shot" ใน `ai-content-pipeline`** — เป็นท่าแก้ uncanny valley เชิง *สุนทรียะ*
   ที่เขาไม่มี เขาแก้ที่ motion เราแก้ที่ look → **สองอันนี้เสริมกัน ไม่ทับกัน**

---

# ส่วน D — แผนก๊อป เรียงตามลำดับที่ควรทำ

## Step 1 — Motion transfer ใน ComfyUI (สำคัญที่สุด ทำก่อนอย่างอื่นทั้งหมด)

เป้าหมาย: workflow ที่รับ `persona image + reference video` แล้วคืน `video`

- หา workflow ที่รองรับ motion transfer มาใส่ตาราง `comfyui_workflows` เป็น `workflow_type = 'VideoMotion'`
  (ตระกูลที่ต้องไปตรวจว่าตัวไหนเหมาะกับ GPU ที่เช่าอยู่: WAN Animate / VACE, UniAnimate, MimicMotion, Champ)
- ขยาย `jobs/video-generator.ts` ให้รับ `referenceVideoUrl` เพิ่ม แล้วเลือก workflow ตามว่ามี reference ไหม
- **ตรวจก่อนลงแรงต่อ:** ทำมือ 1 คลิปให้เห็นผลจริงก่อน ถ้า motion transfer บน GPU ที่มีอยู่ยังไม่สวยพอ
  แผนที่เหลือทั้งหมดต้องคิดใหม่ — อย่าสร้างอะไรต่อจนกว่าข้อนี้จะผ่าน

## Step 2 — Reference intake (ตาราง + ท่อ)

- ตารางใหม่ `reference_clips` — `source_url`, `local_path`, `duration_sec`, `first_frame_url`, `status`, `used_count`, `favorited`
- ต่อ `.claude/skills/reel-intake` ให้เขียนผลลง `reference_clips` แทนที่จะจบที่ `teardown.md`
- ยังไม่ต้องทำ auto-scan โฟลเดอร์ Downloads — อัปโหลดผ่าน `app/api/media/upload` ที่มีอยู่แล้วก็พอ

## Step 3 — Pose matching ด้วย Gemini (ราคาถูก ผลชัด)

ใน `lib/gemini.ts` เพิ่มฟังก์ชัน:
```
extractPoseFromFrame(frameUrl) → { pose, gaze, framing, outfit_shape, camera_angle }
```
แล้วเอา output ไปประกอบกับ identity block ของ persona เป็น image prompt
→ ได้ผลเหมือนโหมด "steal the first frame" ของเขา แต่ไม่ต้องลง Ollama + Qwen

## Step 4 — Image-check gate ก่อนสร้างวิดีโอ

ต่อยอด `jobs/qc-manager.ts` ที่มีอยู่: เพิ่มสถานะ `awaiting_image_approval`
คั่นระหว่าง "ภาพเสร็จ" กับ "เริ่ม render วิดีโอ" — approve / retry / cancel
ต่อให้เรารัน ComfyUI เอง GPU time ก็ยังเป็นเงิน ด่านนี้คุ้มเสมอ

## Step 5 — ทำ scheduler ให้โพสต์ได้จริง

- แก้ `jobs/scheduler.ts` ให้เลิก fake post URL
- `schedules.platform` ต้องรองรับ `instagram` / `tiktok` ไม่ใช่แค่ twitter
- ตั้งค่า: โพสต์สูงสุด/วัน, ช่วงเวลาที่ยอมให้โพสต์, ระยะห่างขั้นต่ำ (ก๊อปตัวเลขเขาไปก่อน: 4/วัน, ห่าง 10–30 นาที)

## Step 6 — เก็บ engagement จริง (ค่อยทำ)

เติม `engagement_logs` ให้มีข้อมูล → ค่อยทำ heat map → **แล้วค่อยคิดเรื่องเรียนรู้เวลาโพสต์ตอนมีข้อมูลพอ**

## สิ่งที่ควร port เข้า `.claude/skills/ai-content-pipeline` ทันที (ทำได้เลยวันนี้ ไม่ต้องรอ Step 1)

1. เพิ่มบล็อก `audience_persona` ใน `personas/TEMPLATE.md` และ persona ที่มีอยู่ — นิยามคนดูให้ชัดแบบเดียวกับที่นิยามตัวโมเดล
2. เพิ่มกฎความยาววิดีโอ default = **7 วินาที** สำหรับ Reel
3. เพิ่มหัวข้อ "uncanny valley check" ในขั้นตอน QC — เกณฑ์ผ่านคือ *ตัวละครคนดูจะรู้สึกแปลกไหม* ไม่ใช่ *สวยไหม*

---

# ส่วน E — ความเสี่ยงที่ต้องรู้ก่อนก๊อป

ไม่ได้ห้าม แต่เขาไม่ได้พูดถึงในคลิป และมันกระทบการตัดสินใจทางธุรกิจจริง

1. **การเอา TikTok คนอื่นมาเป็น source** — เป็นงานดัดแปลงจากงานมีลิขสิทธิ์ และผิด ToS ของ TikTok
   เขารู้ตัวดี: ปิดเสียงคลิปที่โชว์ (12:01) และไม่ยอมโชว์ reel เยอะ "เพราะไม่อยากโดน copyright claim" (10:23)
   → ทางที่ปลอดภัยกว่าและได้ผลเท่ากัน: **ถ่าย motion reference เอง** หรือใช้คลังคลิปที่มีสัญญาอนุญาต
   ท่าเต้น/จังหวะ 7 วินาที ถ่ายเองด้วยมือถือได้ไม่ยาก และตัดความเสี่ยงทิ้งทั้งก้อน
2. **Auto-uploader ที่ล็อกอินบัญชีจริง** — IG จับ automation แล้วแบนบัญชี ซึ่งเป็นทรัพย์สินทั้งหมดของธุรกิจนี้
   ถ้าจะทำ ควรผ่าน Instagram Graph API อย่างเป็นทางการ (ต้องเป็น Business/Creator account)
3. **เอาทรัพย์สินไปฝากไว้กับ prompt ของคนอื่น** — แอปที่ Claude สร้างจาก prompt ก้อนเดียวจะเป็นโค้ดที่ไม่มีใครรีวิว
   ถ้าจะให้มันถือ session IG + API key จริง ควรอ่านโค้ดก่อนใช้

---

# ช่องว่างของ teardown นี้ (ต้องดูภาพถึงจะเติมได้)

teardown นี้สร้างจาก transcript ล้วน ยังขาด:

- [ ] **ชื่อ workflow / โมเดล / setting ที่เห็นบนหน้าจอจริง** — transcript ไม่มี ต้องดูเฟรม
- [ ] เวอร์ชัน Qwen ที่แน่นอน (พูดว่า "2.4" ซึ่งไม่มีจริง — น่าจะ 2.5-VL)
- [ ] layout ของ UI แต่ละแท็บ (inbox / queue / review / performance)
- [ ] หน้าตา heat map และ metric ที่แสดงจริง
- [ ] ยอดวิวจริงของ reel ที่เขาอ้างว่า "best performing"
- [ ] เนื้อหาใน prompt ก้อนใหญ่ที่เขาแจก (อยู่ใต้คลิป)

ทำต่อได้ด้วยการรัน `/reel-intake` บนเครื่อง local ตาม `docs/ai-ofm-teardown-brief.md`
โดยเน้นดูเฟรมช่วง **3:40–13:00** และ **13:00–16:50** ซึ่งเป็นช่วงแชร์หน้าจอ
