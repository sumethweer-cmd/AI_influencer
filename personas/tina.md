---
persona_name: "tina"
trigger_word: "igmodel, tina"
status: active
---

# Persona: Tina

## Identity (ล็อกไว้ ห้ามเปลี่ยนระหว่างสร้าง content — ใช้คำเดิมซ้ำทุกครั้ง)

```yaml
description: "igmodel, tina, a natural Asian beauty with a girl-next-door charm and an hourglass figure"
age: "early 20s"
face:
  preserve_original: true
  ethnicity: "natural Asian features, soft and approachable, not sharp or Eurasian-mixed looking"
  makeup: "soft dewy natural makeup, glossy lips, warm expressive eyes with a girl-next-door charm and a magnetic, curious gaze"
hair:
  color: "natural jet black"
  style: "long sleek straight hair, perfectly smooth with no waves or curls, center part"
  effect: "hair falling straight down past her chest, catching light smoothly"
body:
  frame: "hourglass figure with a snatched, clearly defined small waist"
  chest: "full natural bust, approximately a D-cup"
  weight: "healthy average build with natural softness — not lean/toned athletic, not thin, soft and natural rather than gym-fit"
  skin:
    tone: "natural warm Asian skin tone, not pale or overly bright, realistic warmth"
    texture: "smooth natural skin texture"
distinguishing_marks:
  - "layered thin gold necklaces (delicate chain + small coin pendant + rectangular tag pendant) worn as a signature everyday accessory"
```

## ComfyUI Trigger

```yaml
trigger_word: "igmodel, tina"
```

> LoRA/checkpoint binding จัดการฝั่ง ComfyUI เอง ไม่ต้องระบุในไฟล์นี้ — persona นี้ให้แค่ prompt text

## Reference Material

```yaml
reference_images: "C:\\AI Content\\Tina\\*.jpeg — 4 reference portraits (neutral, smiling at phone/selfie, warm smile, playful wink). Used to lock face/hair/skin/necklace details above."
reference_videos: |
  Analyzed via reel-intake (frame extraction + contact sheet), not just captions:
  - FNR7SY6bIcU, CBxHGawFwxM — reaction/hype-loop format clips (repeated pose + short
    voice line, e.g. "I like it"), different hair/face from Tina's identity. Not used
    for identity/style, kept only as an idea for the "engagement/reaction format" pillar.
  - WNDWuFonk58 — anime-to-real cosplay recreation format: opens on a 2D anime reference
    image, cuts to a real-life recreation of that pose/outfit. Static tripod camera,
    waist-to-full-body framing, no camera movement. Outfit recreated: white ribbed cami
    tank + black athletic shorts with a small logo. Setting: bedroom with sheer white
    curtains, wood dresser, wood floor, natural window light. This is the concrete
    reference for the "anime-to-real cosplay recreation" pillar below.
reference_ig_grid: "2 Instagram profile-grid screenshots provided by the user — primary source for content_pillars below."
```

## Content Niche / Persona Vibe

**Core identity: sexy cosplay + casual IG girl.** NOT gym/fitness-themed at all
(that's m0m0's niche) — Tina's whole identity is trendy Korean-IG-girl energy:
cosplay, casual streetwear, pop-culture/otaku hobbies, sports-fan content, and
hanging out with friends. Every post reads like a real trendy 20-something's
feed, not a themed content account.

```yaml
niche: "Sexy cosplay + casual IG girl (Korean trendy-girl aesthetic) — NOT fitness/gym-themed"
tone: "day-in-my-life trendy IG girl energy, playful and approachable, never staged/professional-looking"
sfw_content_pillars:
  - "Cosplay — anime/game character costumes (e.g. superhero suits, magical-girl outfits, fantasy costumes), form-fitting but not full nudity, worn as genuine hobby content"
  - "Anime-to-real cosplay recreation — references a specific 2D anime character image, recreates that exact pose and a close outfit match in real life; static tripod camera, waist-to-full-body framing; casual everyday-wear versions of anime outfits (e.g. ribbed cami + athletic shorts) rather than full costume; shot in her bedroom with natural window light through sheer curtains"
  - "Reaction/hype format — short repeated pose or gesture (fist pump, hand up, wink) paired with a punchy one-line reaction as the caption/VO hook, engagement-bait energy"
  - "Otaku/pop-culture outings — visiting anime/manga/collectibles stores, holding merch, genuine fan energy"
  - "Casual streetwear OOTD — Korean-style fitted knitwear, wrap/halter tops, pleated skirts, everyday going-out fits"
  - "Photobooth-style 4-cut grid photos — the Korean photo-booth trend, multiple candid poses in one grid"
  - "Friend hangout photos — group selfies, casual outings, genuine social content"
  - "Engagement/question posts — fill-in-the-blank text overlay format, asking followers questions"
  - "GRWM / daily makeup — getting-ready content, talking to camera while doing makeup"
  - "Song cover / talent moments — singing candidly for the camera"
  - "Home mirror/bedroom selfies — casual daily selfies, glossy natural charm"
sfw_posting_rhythm: "mix cosplay, casual OOTD, and lifestyle/friend content across the week — cosplay is a recurring hobby pillar, not the daily default; alternate so the feed reads like a real person's varied life"
fashion_style:
  silhouette: "fitted, figure-emphasizing pieces that show off her waist/curves (crop tops, bodycon/wrap skirts, wrap tops, tucked-in fits) — NOT boxy oversized American streetwear; layering means a thin cardigan/blazer worn open over a fitted base, never baggy head-to-toe layering"
  palette: "Korean pastel/muted tones (baby pink, sage green, cream, lilac, dusty blue) and monochrome neutral sets (all-beige, all-white) — avoid bold primary-color American sportswear palettes"
  signature_pieces: "pleated mini skirts, ribbed knit crop tops/vests, wrap/halter tops, knee-high socks, mary janes or chunky loafers, cardigans worn open over a fitted top"
  accessories: "hair clips/ribbons (ulzzang style), mini crossbody bags, layered gold necklaces (see Identity block, always present)"
  avoid: "oversized boxy silhouettes, US team sportswear/caps, bold primary-color streetwear branding"
nsfw_content_pillars:
  - "Sexy cosplay variant — same costume concepts as SFW but pushed into a more revealing/sultry version, shot amateur/candid, not a staged photoshoot"
  - "Sexy amateur selfie — mirror selfie or held-out phone selfie in minimal/lingerie-adjacent styling, casual bedroom or bathroom setting"
  - "Candid amateur sexy shot — looks like something she took herself and sent, never professional/editorial"
nsfw_posting_rhythm: "fully separate set generated alongside the SFW calendar, not mixed into it — the user picks per-item which set actually gets used. Keep NSFW just as amateur/candid as SFW."
```

## Style / Vibe Default

```yaml
default_aesthetic: "amateur, unposed, real-person-shot-this energy — never editorial/professional/studio-photography looking"
default_lighting: "whatever light is naturally in the room/scene (window light, string lights, indoor lamp, phone flash if dim) — not styled studio lighting"
default_camera_feel: "shot handheld on an iPhone 17 Pro Max, amateur phone-camera framing, mirror selfie or held-out selfie angle — never editorial DSLR, never fine-art/professional photography"
default_mood: "bright, playful, warm, approachable with a naturally flirty undertone through her eyes/smile"
```

> **บังคับใช้ทุก shot:** ทุก `photography.camera_style` ต้องระบุว่าเป็นภาพถ่ายมือสมัครเล่นด้วย **iPhone 17 Pro Max** ไม่ใช่ภาพที่ดู professional/editorial/fine-art — ดูรายละเอียดกฎนี้ใน SKILL.md

## Content Boundaries สำหรับ Persona นี้

```yaml
sfw_default: true
nsfw_allowed: true
nsfw_notes: "suggestive/implied only (sexy cosplay variants, lingerie-adjacent amateur selfies) — ไม่รวม explicit sexual content"
```

> หมายเหตุถาวร: ไม่ว่า field ข้างบนจะระบุอย่างไร ขอบเขตเนื้อหาทางเพศระดับ explicit/hardcore, เนื้อหาเกี่ยวกับผู้เยาว์ หรือ non-consensual ไม่อยู่ในสิ่งที่ผมช่วยสร้างให้ — เป็นข้อจำกัดที่คงที่ ไม่ขึ้นกับไฟล์นี้

## Negative Prompt พื้นฐานของ Tina (ใช้ต่อท้าย negative ทุกภาพ/คลิป)

```
low quality, blurry, distorted anatomy, extra limbs, bad hands, deformed face,
missing necklace, plastic-looking skin, unnatural pose, watermark, text, logo,
overexposed, 3D render look, professional photography, editorial styling,
studio lighting, gym setting, athletic/toned muscular body, wavy or curly hair
```

## Sample Prompt (อ้างอิงตอนสร้างของจริง)

```
igmodel, tina, a natural Asian beauty with a girl-next-door charm, hourglass
figure with a snatched small waist, full natural D-cup bust, healthy soft
natural build. Long sleek straight jet black hair falling past her chest.
Natural warm Asian skin tone, soft dewy makeup, glossy lips, warm expressive
eyes. Layered thin gold necklaces with a small coin and rectangular tag
pendant. [+ outfit / pose / setting / camera specific to this shot]
```

## วิธี Claude ใช้ไฟล์นี้

1. ทุกครั้งที่สร้าง content ให้ Tina ดึง **Identity block** มาใช้คำเดิมเป๊ะ ห้ามเปลี่ยนคำบรรยายตัวละครระหว่าง shot/ภาพในชุดเดียวกัน — รวมถึงสร้อยทองคำ layered ที่เป็น signature accessory ต้องอยู่ทุกภาพ เว้นแต่ concept ระบุชัดว่าไม่ใส่
2. ใส่ `igmodel, tina` ไว้เป็นคำแรกสุดของทุก positive prompt เสมอ
3. ถ้าผู้ใช้ไม่ได้ระบุ lighting/mood/camera ให้ใช้ค่าใน **Style/Vibe Default**
4. Negative prompt พื้นฐานของ Tina ต้องต่อท้ายทุกครั้ง (เพิ่มเติมได้ตาม shot แต่ไม่ตัดออก) — สังเกตว่ามี "athletic/toned muscular body" และ "wavy or curly hair" อยู่ใน negative baseline เพื่อกันไม่ให้ภาพเพี้ยนไปทาง m0m0 (คนละ persona คนละทรง)
5. Output ทุกชิ้นแยกเป็นไฟล์ .txt ตาม naming convention ที่กำหนดใน `.claude/skills/ai-content-pipeline/SKILL.md`

## TODO ก่อนใช้งานจริงเต็มรูปแบบ
- [ ] ทดสอบสร้าง content จริง แล้วปรับ default_aesthetic/lighting/content_pillars ตามผลลัพธ์ที่ได้
- [ ] ถ้ามี reference video ที่ดีกว่านี้ (มี description/caption ที่ใช้ได้จริง) ส่งมาเพิ่มได้ เพื่อวิเคราะห์ style เพิ่มเติม
