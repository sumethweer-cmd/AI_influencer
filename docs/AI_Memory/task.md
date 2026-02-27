# Nong Kung Agency - Task Breakdown

## Phase 0: Project Setup
- [x] กำหนดโครงสร้างโปรเจกต์ (Tech Stack, Directory, Naming Convention)
- [x] สร้าง Supabase project และออกแบบ Database Schema
- [x] สร้าง Next.js project ใหม่
- [x] ตั้งค่า Environment Variables ทั้งหมด

## Phase 1: The Strategic Scout (Weekly Planning)
- [x] สร้าง Script ดึงเทรนด์จาก X/Instagram แบบอัตโนมัติ (Option 1: Apify)
- [x] สร้าง Script ให้ AI คิดหัวข้อเอง (Option 2: AI Brainstorming + Custom Text Prompt)
- [x] สร้าง Script วิเคราะห์ต้นแบบจากรูปภาพ (Option 3: Reference Image Upload)
- [x] **[NEW] เลือก Persona (Momo หรือ Karen) ก่อนเริ่มสร้าง Content Plan**
- [x] **[NEW] บังคับให้ AI แตก Caption เป็นภาษาอังกฤษ (English) เสมอ**
- [x] **[NEW] เก็บข้อมูล Token Usage (Input/Output) เพื่อประเมินค่าใช้จ่าย Gemini API**
- [x] เชื่อมต่อ Gemini 1.5 Pro วิเคราะห์และสร้างแผน (21 โพสต์/สัปดาห์) โดยเจาะจงเฉพาะ Persona ที่เลือก
- [x] บันทึกผลลัพธ์ลง Supabase (table: `weekly_plans` & `content_items`) คอลัมน์ใหม่: `gen_sfw`, `gen_nsfw`, `post_to_ig`, `post_to_x`, `post_to_fanvue`
- [x] ตั้งสถานะเริ่มต้นของ Content เป็น 'Draft'

## Phase 1.5: Plan Review & Editing (Pre-Production)
- [x] UI สำหรับ Review แผนทั้งหมด 21 items ก่อนส่งไปสร้างรูป
- [x] สามารถ Edit Content Type (Post, Carousel, Story) ได้
- [x] **[NEW] แสดงปุ่ม View Prompt / Caption Review เพื่อให้ตรวจสอบ/แก้ไขข้อความก่อนเจนรูป**
- [x] **[NEW] เพิ่ม Component เลือก Scheduled Date เพื่อตั้งเวลาโพสต์ล่วงหน้า**
- [x] **[NEW] ระบบอัปโหลดและเลือก ComfyUI Workflow JSON แบบอิสระ (Select Workflow Template)**
- [x] Checkboxes: เลือกสร้าง SFW (Default) / NSFW (Optional) แยกกัน
- [x] Checkboxes: เลือก Platform ที่จะโพสต์ (IG = SFW Only, X, Fanvue)
- [x] ปุ่ม "Confirm & Start Production" เพื่อส่ง Draft ทั้งหมดไป Phase 2

## Phase 2: The Automated Production (Runpod & ComfyUI)
- [x] สร้าง Runpod API Connector (Deploy/Terminate Pod)
- [x] สร้าง ComfyUI Batch Processing System
- [x] Logic: NSFW=True → รัน 2 Workflows (SFW และ NSFW) โดยใช้ Seed และ Lighting เดียวกัน
- [x] ระบบดาวน์โหลดรูปและจัดเก็บแยกโฟลเดอร์ตาม ID คอนเทนต์และประเภท (SFW/NSFW)

## [NEW] Phase 2.5: Production Monitoring System
- [x] สร้างตาราง `production_jobs` เพื่อเก็บ Tracking logs แบบ Real-time
- [x] ติดตั้ง Progress Updater ภายใน `jobs/production-runner.ts` (บอกสเต็ป: Deploy, Gen รูป, Terminate)
- [x] สร้าง UI Progress Bar ในหน้า Dashboard แสดงสถานะการเจนรูปปัจจุบัน

## Phase 3: Manual QC & Approval Dashboard (Merged old Phase 3 & 4)
- [x] สร้าง Next.js Dashboard หน้าหลัก (Dashboard UI ปัจจุบัน)
- [/] Calendar View แสดง 21 Content ต่อสัปดาห์
- [x] Left-hand Sidebar: Filter ระหว่าง All, Momo, Karen
- [x] NSFW Security: Blur เริ่มต้น + ปุ่ม 👁️ Unblur
- [ ] UI เปลี่ยนจาก AI QC เป็น Human QC: ให้คนเลือกรูปที่ดีที่สุดจากหน้า Content Card / Calendar
- [ ] Logic การ Re-gen ภาพ (Regenerate): ส่งคำสั่งเจนใหม่โดยใช้ข้อมูลเดิม (Seed/Prompt) เพื่อให้ภาพสอดคล้องกัน (ยังต้องออกแบบต่อ)
- [/] ฟีเจอร์: Selection, Crop, แก้ไข Caption ก่อน Approve
- [x] Approve → Status "Scheduled" + ระบุเวลาโพสต์

## Phase 6: Dynamic API Configuration
- [x] สร้างตาราง `system_configs` ใน Supabase สำหรับเก็บ API Keys
- [x] สร้างหน้า Settings Dashboard พร้อม UI คู่มือ (Guides)
- [x] สร้างระบบตรวจสอบความถูกต้องของ API Keys (Test Connection)
- [x] ปรับปรุง Libraries ให้ดึง Key จาก Database แทน Environment Variables
- [x] เพิ่มระบบรักษาความปลอดภัย (Encryption) สำหรับข้อมูลลับ (Secret Keys)
