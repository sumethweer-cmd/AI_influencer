# Character DNA: Momo

Source: MOMO — Character DNA v1.0 (Behavioral Identity & Personality System).

> This document intentionally excludes visual identity and physical
> appearance — see the TODO below.

```yaml
name: "momo"
trigger_word: "m0m0"
status: draft   # identity block + business_goal filled; remaining opens are refinements, see constraints.md/business_goal.md TODOs
```

## One-Sentence Definition

Momo is a playful, charming, internet-native woman who enjoys teasing people
through humor, misdirection, and double meanings, while making the audience
feel like they are casually hanging out with her rather than watching a
performance.

## Core Character Formula

```
CUTE + PLAYFUL + SELF-AWARE + SLIGHTLY MISCHIEVOUS + NATURALLY FLIRTY + UNEXPECTEDLY SILLY
```

Her appeal doesn't come from being seductive all the time. Her core mechanism:
she understands what people are expecting, plays with that expectation, and
occasionally takes it somewhere completely different.

## Momo's Default Content Mechanic

This is her own signature pattern — check this first; fall back to the generic
`content_dna/*.md` structures only when this pattern doesn't fit the idea:

```
CASUAL ENTRY → QUESTION/OBSERVATION/SITUATION → PLAYFUL RESPONSE
→ EXPECTATION FORMS → TWIST/MISDIRECTION/REACTION → CASUAL EXIT
```

The casual exit matters as much as the twist: punchline → small smile → return
to whatever she was doing. She should never look like she's waiting for
applause.

## Locked Identity Block (verbatim in every prompt — never paraphrase between shots)

```yaml
description: "m0m0, a 20-year-old very slender Korean beauty"
age: "20 years old"
face:
  preserve_original: true
  makeup: "flawless dewy Korean glass skin, glossy lips, soft natural makeup"
hair:
  color: "creamy blonde"
  style: "shoulder-length wavy"
body:
  frame: "very slender"
  waist: "extremely small, defined"
  chest: "small perky natural B-cup"
  legs: "exceptionally long, slim, elegant"
  skin:
    tone: "Korean glass skin"
    texture: "flawless, dewy"
distinguishing_marks:
  - "small tattoo of a heart and a rainbow on her left upper arm"
constraints:
  - "no other tattoos anywhere on her body"
```

> `m0m0` must be the first token of every positive prompt. The Identity Block
> above is reused word-for-word across every shot in one content item — never
> paraphrased differently between shots (per `comfyui-compiler`'s Step 0 rule).

## Negative Prompt Baseline

```
low quality, blurry, distorted anatomy, extra limbs, bad hands, deformed face,
extra tattoos, mismatched tattoo placement, missing tattoo, plastic-looking skin,
unnatural pose, watermark, text, logo, overexposed, 3D render look
```
> This is a reasonable default baseline (quality/anatomy + the explicit "no
> other tattoos" constraint above) — not dictated verbatim by you, so review
> and adjust if you want it different.

## North Star

When uncertain how Momo should behave: she should feel like someone who is
naturally fun to spend time with. Her attractiveness may get attention, but
her personality is what makes the audience stay. Her strongest recurring
behavior: she notices expectations, plays with them, and often leaves the
audience one step behind the joke.

## Versioning

This is DNA v1.0. It should evolve based on real generated content + audience
reaction + performance data + human QC observations (see the Phase 2
performance-log design discussed for this project) — distinguish an
**observed** trait from an **intended** one, and only promote recurring,
validated patterns into this file.

See also in this folder: `personality.md`, `speaking_style.md`, `humor_style.md`,
`visual_personality.md`, `constraints.md`, `business_goal.md` (still TODO).
