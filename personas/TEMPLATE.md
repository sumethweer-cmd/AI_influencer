---
persona_name: "{{name}}"
trigger_word: "{{comfyui_trigger_word}}"
status: draft
---

# Persona: {{name}}

หมายเหตุ: ไฟล์นี้เป็น template — copy ไปตั้งชื่อใหม่เป็น `{{name}}.md` แล้วแทนที่ `{{...}}` ทุกจุดด้วยข้อมูลจริง ส่วนไหนไม่ใช้ให้ลบทิ้ง ไม่ต้องเก็บ placeholder ค้างไว้

## Identity (ล็อกไว้ ห้ามเปลี่ยนระหว่างสร้าง content — ใช้คำเดิมซ้ำทุกครั้ง)

```yaml
description: "{{trigger_word}}, {{age}}-year-old {{ethnicity/style}}, {{one-line summary}}"
age: "{{age}} years old"
face:
  preserve_original: true
  makeup: "{{makeup style}}"
hair:
  color: "{{hair color}}"
  style: "{{length/style}}"
  effect: "{{how it moves/falls}}"
body:
  frame: "{{body type}}"
  waist: "{{waist description}}"
  chest: "{{chest description}}"
  legs: "{{legs description}}"
  skin:
    tone: "{{skin tone}}"
    texture: "{{skin texture}}"
distinguishing_marks:
  - "{{tattoo/scar/mole ฯลฯ ถ้ามี — ระบุตำแหน่งชัดเจน}}"
```

## ComfyUI Trigger / LoRA

```yaml
trigger_word: "{{คำที่ต้องใส่นำหน้า prompt ทุกครั้งเพื่อเรียก LoRA/identity}}"
lora_name: "{{ชื่อไฟล์ LoRA ถ้ามี}}"
lora_strength: "{{ค่า strength แนะนำ เช่น 1.0}}"
base_checkpoint: "{{checkpoint ที่ใช้คู่กับ persona นี้ เช่น Krea2, Flux, SDXL}}"
```

## Style / Vibe Default (ใช้เป็นค่าตั้งต้น ปรับได้ต่อ content แต่ถ้าไม่ระบุให้ใช้ค่านี้)

```yaml
default_aesthetic: "amateur, unposed, real-person-shot-this energy — {{ปรับ mood เพิ่มได้ แต่ห้ามเป็น editorial/professional/studio-photography looking}}"
default_lighting: "{{แสงจริงในฉาก เช่น window light/gym overhead/phone flash — ไม่ใช่ studio lighting จัดแสง}}"
default_camera_feel: "shot handheld on an iPhone 17 Pro Max, amateur phone-camera framing, mirror selfie หรือ held-out selfie angle — ห้าม editorial DSLR, ห้าม fine-art/professional photography"
default_mood: "{{เช่น cheerful, confident, playful}}"
```

> **บังคับใช้ทุก shot:** ทุก `photography.camera_style` ต้องระบุว่าเป็นภาพถ่ายมือสมัครเล่นด้วย **iPhone 17 Pro Max** เสมอ ไม่ว่า persona นี้จะปรับ mood/aesthetic ยังไงก็ตาม — ดูรายละเอียดกฎนี้ใน SKILL.md

## Content Boundaries สำหรับ Persona นี้

```yaml
sfw_default: true
nsfw_allowed: {{true/false}}
nsfw_notes: "{{ถ้า nsfw_allowed = true ระบุขอบเขตที่อนุญาต เช่น suggestive/implied เท่านั้น — ไม่รวม explicit}}"
```

> หมายเหตุถาวร: ไม่ว่า field ข้างบนจะระบุอย่างไร ขอบเขตเนื้อหาทางเพศระดับ explicit/hardcore, เนื้อหาเกี่ยวกับผู้เยาว์ หรือ non-consensual ไม่อยู่ในสิ่งที่ผมช่วยสร้างให้ — เป็นข้อจำกัดที่คงที่ ไม่ขึ้นกับไฟล์นี้

## Negative Prompt พื้นฐานของ Persona นี้ (ใช้ต่อท้าย negative ทุกภาพ/คลิป)

```
{{negative prompt list ที่ควรมีทุกครั้ง เช่น extra limbs, mismatched tattoo, plastic skin, ...}}
```

## Sample Prompt (อ้างอิงตอนสร้างของจริง)

**ตัวอย่าง 1 บรรทัดที่ประกอบสำเร็จแล้ว (สำหรับ reference):**
```
{{trigger_word}}, {{full descriptive sentence ตัวอย่างที่เคยได้ผลดี}}
```

## วิธี Claude ใช้ไฟล์นี้

1. ทุกครั้งที่สร้าง content ให้ persona นี้ ให้ดึง **Identity block** มาใช้คำเดิมเป๊ะ ห้ามเปลี่ยนคำบรรยายตัวละครระหว่าง shot/ภาพในชุดเดียวกัน
2. ใส่ `trigger_word` ไว้เป็นคำแรกสุดของทุก positive prompt เสมอ
3. ถ้าผู้ใช้ไม่ได้ระบุ lighting/mood/camera ให้ใช้ค่าใน **Style/Vibe Default**
4. Negative prompt พื้นฐานของ persona นี้ต้องต่อท้ายทุกครั้ง (เพิ่มเติมได้ตาม shot แต่ไม่ตัดออก)
5. Output ทุกชิ้นให้แยกเป็นไฟล์ .txt ตาม naming convention: `{{persona}}_{{date}}_item{NN}_{type}_{shotN}.txt` (ดูรายละเอียดใน `.claude/skills/ai-content-pipeline/SKILL.md`)
