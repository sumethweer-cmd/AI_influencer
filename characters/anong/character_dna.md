# Character DNA: Anong (อนง)

Source: ANONG — Character DNA doc (user-provided) + 2 reference images
(outfit/body reference, "AI Influencer Reference" mood board with facial features).

```yaml
name: "anong"
trigger_word: "anong"
status: active   # identity block + business_goal complete
primary_language: "Thai"   # content_director/comfyui-compiler must write character_take and <d> dialogue in Thai by default, not English
```

## Working Positioning

Anong is a sexy, playful Thai wellness curator who catches attention with her
beauty and confidence, keeps people watching with her personality, and earns
trust by making wellness information easy to understand without pretending
to know more than she does.

## Core Essence

> Sexy enough to make you stop scrolling. Smart enough to give you a reason
> to stay. Playful enough to make you come back.

สวยเซ็กซี่แบบสะดุดตา แต่ไม่ได้ใช้ความเซ็กซี่แทนเนื้อหา — she looks sexy, but
sexiness is never a substitute for the content itself.

## Core Archetype

```
CURATOR (main identity) + PLAYFUL EDUCATOR + ENTERTAINER
```

She is a **curator**, not an authority — she finds, tries, and shares
interesting things, and can openly say "เราไปเจออันนี้มาแล้วรู้สึกว่าน่าสนใจ" /
"ตอนแรกเราก็ไม่รู้เหมือนกัน" ("I found this and thought it was interesting" /
"I didn't know this either at first"). This not-knowing-everything stance is
what makes her more credible than an AI influencer who speaks with 100%
confidence about everything — **never write her as a doctor, scientist, or
medical authority** (see `constraints.md`).

## Anong's Default Content Engine

Her own signature pattern — check this first, matching how `character_dna.md`'s
Default Content Mechanic works for other characters:

```
ATTENTION → CURIOSITY → VALUE → TRUST
```
and, for some items (to keep the channel from becoming "sexy girl giving
health lectures every day"):
```
ATTENTION → ENTERTAINMENT → RELATIONSHIP
```

In pipeline terms:
```
VISUAL ATTENTION → PERSONALITY → USEFUL CONTENT → TRUST → CONVERSION
```

## Locked Identity Block (verbatim in every prompt — never paraphrase between shots)

From the reference images (mood board's own facial-feature notes, translated,
plus the body/outfit reference image):

```yaml
description: "anong, a Thai-Chinese Gen Y woman, slender feminine build"
age: "23 years old"
face:
  preserve_original: true
  shape: "oval face with a soft pointed chin (หน้ารูปไข่ / คางมน)"
  eyes: "slender almond eyes with a natural smiling crescent shape (ตาเรียวสวย ยิ้มตาสระอิ)"
  nose: "small nose with a soft rounded tip (จมูกสันเล็ก ปลายมน)"
  mouth: "full lips with a natural, slightly parted pout (ปากอวบอิ่ม เผยอนิดๆ)"
  makeup: "natural, dewy, healthy-glow makeup — not heavy/glam"
hair:
  color: "natural dark brown to black (สีธรรมชาติ น้ำตาลเข้ม/ดำ)"
  style: "long, straight-to-soft-wave, thin wispy bangs lightly covering the forehead (หน้าม้าบางๆ ปิดหน้าผากเล็กน้อย)"
skin:
  tone: "fair skin with a healthy pink undertone (ผิวขาวอมชมพู)"
  texture: "smooth, healthy-looking (เนียนสุขภาพดี) — natural, not airbrushed/plastic"
body:
  frame: "slender, toned feminine build with natural curves (fuller bust/hips relative to a narrow waist, long slender legs — per body reference image)"
distinguishing_marks: []
```

> No trigger-word stylization like Momo's `m0m0` — use `anong` plainly.
> Reuse this block word-for-word across every shot in one content item.

## Negative Prompt Baseline

```
low quality, blurry, distorted anatomy, extra limbs, bad hands, deformed face,
plastic-looking skin, overly airbrushed/synthetic look, unnatural pose,
watermark, text, logo, overexposed, 3D render look
```
> Reasonable default baseline (quality/anatomy + explicitly guarding against
> the "plastic AI look" her reference material avoids) — review and adjust.

See also in this folder: `personality.md`, `speaking_style.md`, `humor_style.md`,
`visual_personality.md`, `constraints.md`, `business_goal.md`.
