# Nong Kung Agency — Implementation Plan

โปรเจกต์นี้คือระบบอัตโนมัติแบบ End-to-End สำหรับบริหารจัดการ **AI Influencer** ครบวงจร ตั้งแต่การวางแผนคอนเทนต์รายสัปดาห์, การผลิตภาพด้วย AI, การตรวจ QC, การอนุมัติโดย Owner, ไปจนถึงการโพสต์และติดตามผลโดยอัตโนมัติ

---

## User Review Required

> [!IMPORTANT]
> **Tech Stack Confirmation**: ก่อนเริ่ม ต้องการให้คุณสุเมธยืนยัน:
> 1. **Frontend**: Next.js 15 (App Router) — ใช้ได้เลย หรืออยากเปลี่ยน?
> 2. **Backend/DB**: Supabase — ใช้ Project ที่มีอยู่แล้ว หรือสร้างใหม่?
> 3. **Runpod Template**: ชื่อ Template ที่ใช้คือ `"new Template V.2"` — ถูกต้องไหม? และ API Key ของ Runpod พร้อมให้หรือยัง?
> 4. **Apify**: มี API Token ของ Apify พร้อมหรือยัง?
> 5. **Posting Platform**: Phase 5 จะโพสต์ผ่าน X/Twitter เป็นหลัก หรือมี Platform อื่นด้วย (เช่น Instagram)?

> [!WARNING]
> **NSFW Content**: ระบบจะรองรับการสร้างและจัดเก็บ NSFW Content ซึ่งต้องมีการรักษาความปลอดภัยอย่างเข้มงวด (Auth, Blur, Access Control) ต้องแน่ใจว่าสอดคล้องกับ Terms of Service ของ Platform ที่จะโพสต์

---

## Proposed Changes

### Phase 0: Project Foundation

#### [NEW] Next.js 15 Project — `/nong-kung-agency/`
- สร้างโปรเจกต์ใหม่ด้วย `create-next-app` ใน `C:\Users\HP\.gemini\antigravity\scratch\nong-kung-agency`
- โครงสร้างหลัก:
```
nong-kung-agency/
├── app/               # Next.js App Router
│   ├── dashboard/     # Phase 4: Approval Dashboard
│   └── api/           # API Routes สำหรับทุก Phase
├── lib/               # Shared utilities & API clients
│   ├── apify.ts
│   ├── gemini.ts
│   ├── runpod.ts
│   ├── comfyui.ts
│   ├── telegram.ts
│   └── supabase.ts
├── jobs/              # Background Job runners (Phase 1-3, 5)
└── types/             # Shared TypeScript types
```

#### [NEW] Supabase Schema
ตารางหลักในฐานข้อมูล:

| Table | Description |
|---|---|
| `content_items` | เก็บ Content Matrix ทั้ง 21 ชิ้น, ตัวแปรการโพสต์แพลตฟอร์ม, ค่าการเลือก SFW/NSFW, และสถานะ |
| `weekly_plans` | เก็บ weekly_plan.json รายสัปดาห์ |
| `generated_images` | Path รูปภาพที่ generate แล้ว + Quality Score |
| `schedules` | กำหนดการโพสต์ที่ Approve แล้ว |
| `engagement_logs` | บันทึก Engagement จาก Platform |

**Database Schema Update (Phase 1.5 Update):**
```sql
ALTER TABLE public.content_items 
ADD COLUMN IF NOT EXISTS gen_sfw BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gen_nsfw BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS post_to_ig BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS post_to_x BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS post_to_fanvue BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS persona VARCHAR(255);
```

**Job Status Flow:**
```
Draft (Phase 1.5 Review) → In Production (Phase 2) → QC Pending (Phase 3) → Awaiting Approval (Phase 4) → Scheduled → Published
```

---

### Phase 1: The Strategic Scout (Weekly Planner)

ระบบทำการสร้าง Weekly Plan (21 โพสต์) โดยรองรับ 3 รูปแบบการหาไอเดีย:

1. **Option 1: Trend Scraping (ปัจจุบัน)**
   - ดึง Hashtag/Trend จาก `Apify` X และ Instagram.
   - ส่งข้อมูลเทรนด์เข้า Gemini 1.5 Pro เพื่อสร้าง Content Plan ให้สอดคล้องกับกระแส

2. **Option 2: AI Brainstorming (Manual Prompt)**
   - ผู้ใช้พิมพ์คำสั่ง (Prompt/Theme) กว้างๆ ในหน้า Dashboard (เช่น "สัปดาห์นี้ขอธีมชุดว่ายน้ำสดใส ถ่ายที่ทะเลภูเก็ต เน้น Activity กีฬาทางน้ำ")
   - ส่งคำสั่งเข้า `Gemini 1.5 Pro` ให้สวมบทบาท Creative Director และช่วยคิดรายละเอียด แตกไอเดียภาพและแคปชั่นให้ครบ 21 โพสต์โดยไม่ต้องพึ่งพาข้อมูลภายนอก

3. **Option 3: Reference Image Upload**
   - ผู้ใช้อัปโหลดภาพต้นแบบ (Reference Image) ในหน้า Dashboard
   - ส่งภาพพร้อมคำสั่งเข้า `Gemini 1.5 Pro (Vision)` ให้สกัด 1. สไตล์ภาพ 2. แสงสี 3. ท่าโพส 4. เสื้อผ้า ออกมาเป็น Text Prompt
   - นำคุณสมบัติที่สกัดได้ไปสร้างเป็น Content Plan 21 รูปแบบที่มีความคล้ายคลึงหรืออยู่ใน Theme เดียวกับรูปต้นแบบ

> **🔑 Caption Language Rule:** แคปชั่น (Caption) ทั้งหมดที่ AI สร้างขึ้นในขั้นตอนนี้ **จะต้องถูกสร้างเป็นภาษาอังกฤษ (English) เสมอ** ตามความต้องการใหม่ของผู้ใช้ เพื่อรองรับกลุ่มเป้าหมายสากลบน Fanvue/X

#### [MODIFY] `app/api/jobs/phase1-planner/route.ts`
- รับ Request Body `scoutMethod` ('apify' | 'brainstorm' | 'image')
- รับ `customPrompt` (for Option 2/3) และ `imageBase64` (for Option 3)
- เรียกฟังก์ชันใน `lib/gemini.ts` ตาม Method ที่เลือก

#### [MODIFY] `lib/gemini.ts`
- เพิ่มเงื่อนไขให้ Prompt แครกแคปชั่นเป็น "English ONLY" บังคับอย่างเด็ดขาด
- เพิ่มระบบนับ Token Usage (Input/Output Tokens) ที่ได้มาจาก Google Generative AI Response และบันทึกลง Logs
- บันทึกลง Supabase (`weekly_plans` + `content_items` โดยตั้งค่า defaults: `gen_sfw=true`, `gen_nsfw=false`, `post_to_ig=true`, `post_to_x=false`, `post_to_fanvue=false`)

---

### [NEW] Phase 1.5: Plan Review (Draft Editor)

เป็นหน้า UI ใหม่สำหรับแก้ไข Content Plan 21 รายการ **ก่อน**ที่จะกดตกลงให้ไปสร้างรูปภาพ (Phase 2)

#### Features:
1. **Dropdown Select Persona**: เลือกระหว่าง Momo หรือ Karen
2. **Review List**: แสดงการ์ด 21 ใบ เรียงกัน (ยังไม่มีรูปภาพ)
3. **Editable Fields**:
   - Content Type (`Post`, `Story`, `Carousel`)
   - **View Prompt Button**: ปุ่มสำหรับกดดู Prompt ภาพรวมที่ AI แต่งมาให้ (Text Area ที่แก้ไขได้)
   - **Schedule Date Planner**: ระบุ Expected Post Date/Time ล่วงหน้าได้ตั้งแต่ขั้นตอนนี้
   - Image Generation Flags: `[x] Generate SFW` / `[ ] Generate NSFW`
   - Platform Flags: `[x] IG` (เฉพาะโหมด SFW), `[ ] X`, `[ ] Fanvue`
4. **Action Button**: `"Confirm Plan & Start Generation"` → เปลี่ยน status เป็น `In Production` และกระตุ้น ComfyUI Job
5. **Logic**: SFW/NSFW separation. SFW ห้ามตั้งให้โพสต์ลง IG หากมีการเลือกรูป NSFW ด้วย

---

### Phase 2: The Automated Production

#### [NEW] `lib/runpod.ts` — Runpod API Client
- `deployPod()`: Deploy Pod จาก Template `"new Template V.2"`
- `terminatePod()`: Terminate Pod หลังเจนเสร็จ
- `getPodStatus()`: ตรวจสอบสถานะ Pod

#### [NEW] `lib/comfyui.ts` — ComfyUI Batch Processor
- ส่ง JSON Workflow เข้า ComfyUI API
- Logic: ถ้า `nsfw_option = true` → รัน 2 Workflows (SFW + NSFW) ด้วย Seed เดียวกัน
- ดาวน์โหลดรูปและจัดเก็บ: `/images/{content_id}/SFW/` และ `/images/{content_id}/NSFW/`

#### [NEW] `jobs/production-runner.ts` — Production Orchestrator
- อ่าน `weekly_plan.json` → Deploy Pod → Batch Process → Download → Terminate Pod
- อัปเดต Status → `"In Production"` ระหว่างรัน

---

### [NEW] Phase 2.5: Production Monitoring

ระบบสำหรับติดตามสถานะการรันภาพของ Phase 2 เพื่อให้ผู้ใช้มองเห็นความคืบหน้าแบบ Real-time บน Dashboard

#### [NEW] Supabase Schema `production_jobs`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Job ID |
| `status` | VARCHAR | e.g. Starting, Deploying Pod, Waiting for ComfyUI, Generating, Terminating Pod, Completed, Failed |
| `runpod_id` | VARCHAR | ผูกกับ Pod ID ที่กำลังรัน |
| `total_items` | INT | จำนวนภาพทั้งหมดที่ต้อง Gen ใน Batch นี้ |
| `completed_items` | INT | จำนวนภาพที่ Gen เสร็จแล้ว |
| `current_item_id` | UUID | Content ID ที่กำลังดำเนินการอยู่ |

#### [MODIFY] `jobs/production-runner.ts`
- เริ่มต้นฟังก์ชัน: สร้าง row ใหม่ลงใน `production_jobs` กำหนด `status = Deploying Pod`
- ระหว่างการวนลูป (For loop): อัปเดต `current_item_id` และ `completed_items`
- เมื่อจบการทำงาน: อัปเดตสถานะเป็น `Completed`

#### [NEW] `app/api/jobs/monitor/route.ts`
- API สำหรับให้ Frontend ยิงเพื่อขออ่านสถานะ Job ปัจจุบัน (Job ล่าสุดที่ status != Completed/Failed)

#### [NEW] `app/dashboard/components/ProductionMonitor.tsx`
- Component บน Dashboard สำหรับ Polling API (ทุกๆ 5 วินาที)
- แสดง Progress Bar (%) ที่คำนวณจาก `completed_items / total_items`
- แสดงข้อความ Status ล่าสุดให้ผู้ใช้งานทราบ

---

### Phase 3: Manual QC & Approval Dashboard (Formally Phase 3 & Phase 4)

หลังจาก Phase 2 สร้างรูปภาพเสร็จ Content จะเข้าสู่สถานะ `Ready for Review` เพื่อให้เจ้าของโปรเจกต์ (Human) เป็นคนตรวจสอบเอง (ยกเลิก AI QC)

#### [NEW] `app/dashboard/page.tsx` — Main Dashboard
- Calendar View: แสดง 21 Content ต่อสัปดาห์
- แสดง Thumbnail, Topic, Caption, Status ของแต่ละ Content
- การจัดการรูปภาพหลายใบ: หน้า Content Card จะอนุญาตให้ผู้ใช้ **เลือกรูปภาพที่ดีที่สุด** จากหลายๆ Generation
- ปุ่ม **Regenerate (Re-gen)**: ส่งคำสั่งสร้างรูปภาพใหม่โดยใช้ Seed เดิม หรือ Prompt เดิมเพื่อแก้ไขจุดบกพร่อง (Flow ของระบบ Re-gen จะถูกออกแบบในอนาคต)

#### [NEW] `app/dashboard/components/`
- `ContentCard.tsx`: Card แสดงรูป + Info (มี Blur สำหรับ NSFW) และระบบเลือกรูปภาพ
- `NSFWCard.tsx`: Blur เริ่มต้น + ปุ่ม 👁️ Unblur (พร้อม PIN Auth)
- `CaptionEditor.tsx`: แก้ไข Caption
- `ImageCropper.tsx`: Crop รูปก่อน Approve
- `ApproveModal.tsx`: เลือกวันเวลาโพสต์ → Status "Scheduled"

---

### Phase 5: Monitoring & Notification

#### [NEW] `lib/telegram.ts` — Telegram Bot Client
- ส่ง Notification เมื่อ: เจนรูปเสร็จ, โพสต์สำเร็จ, Error
- Daily Engagement Summary Report

#### [NEW] `jobs/scheduler.ts` — Auto-Post Scheduler
- อ่าน Content ที่ Status = "Scheduled" และถึงเวลาแล้ว
- โพสต์ผ่าน X/Twitter API v2
- อัปเดต Status → "Published"

#### [NEW] `app/dashboard/analytics/page.tsx` — Engagement Analytics
- แสดง Daily Engagement Summary จาก `engagement_logs`

---

## Verification Plan

### ขั้นตอนการ Verify แต่ละ Phase

| Phase | วิธี Verify |
|---|---|
| Phase 0 | Build สำเร็จ + Supabase เชื่อมต่อได้ |
| Phase 1 | รัน `weekly-planner.ts` → ตรวจ `weekly_plan.json` ใน Supabase |
| Phase 2 | รัน `production-runner.ts` กับ Test Content → ตรวจไฟล์รูปในโฟลเดอร์ |
| Phase 3 | รัน `qc-manager.ts` กับรูปตัวอย่าง → ตรวจ Score และ Re-gen Logic |
| Phase 4 | เปิด Dashboard, ทดสอบ Blur/Unblur, Approve, Crop |
| Phase 5 | ทดสอบ Telegram Bot ส่งข้อความ + ตรวจ Scheduler Log |
| Phase 6 |
1. เพิ่ม Key ผ่าน UI → ตรวจตารางใน Supabase
2. กด Test Connection → ตรวจว่าระบบสามารถเรียก API เจ้านั้นๆ ได้จริง
3. ลบ Environment Variables แต่ออก → ระบบยังต้องทำงานได้โดยใช้ Key จาก DB
 |

### Manual Verification (Dashboard)
1. รัน `npm run dev`
2. เปิด `http://localhost:3000/dashboard`
3. ตรวจ Calendar View
4. คลิก NSFW Content → ตรวจว่า Blur อยู่ก่อน กด Unblur
5. กด Approve → กรอกเวลาโพสต์ → ตรวจ Status ใน Supabase
