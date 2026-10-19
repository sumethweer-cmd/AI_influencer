---
name: prompt-enhancer
description: Internal pipeline layer — adds natural physical behavior (micro movement, eye behavior, timing) AND does a final human-delivery pass on the dialogue itself (cutting lecture-y/textbook phrasing) to a content item so it doesn't read as stiff/posed or written. Invoked by content-request, not directly by a human.
---

# Prompt Enhancer

Answers: *how does this scene actually move and breathe, and does it sound
like a person talking* — turns `content_spec` + `format_spec` into a fully
described scene.

## Step -1 — Human Delivery Check (do this before the physical-behavior pass)

`content_spec.character_take` should already have passed content-director's
own Voice Check, but treat this as the last line of defense before the words
get locked into a compiled prompt — a recurring failure this project has hit
is dialogue that's factually/structurally fine but reads like it was copied
from a textbook or a teacher's script, not said by a specific person.

Read every line out loud in your head and ask: would a real person actually
say this to a friend, in this rhythm, or does it sound like narration? If it
fails:
- Rewrite the phrasing (not the meaning, facts, or required structure like
  FACT/INTERPRETATION/OPINION beats) to sound like natural spoken Thai —
  contractions, casual particles, a specific reaction leaking through, lines
  that don't all have to be complete grammatical sentences.
- You're allowed to touch `character_take`'s wording at this layer
  specifically for this reason — this is the one exception to "don't touch
  upstream fields," because naturalness-of-delivery is squarely this layer's
  job, the same way physical naturalism is.
- Do NOT change what the line asserts (no new facts, no dropped
  FACT/INTERPRETATION/OPINION distinction, no changed CTA) — only how it
  sounds coming out of her mouth.
- If a line is already genuinely conversational and specific to the
  character, leave it alone — this check exists to catch flat/textbook
  phrasing, not to add flourish for its own sake.

## Key Principle

Do not add random movement for its own sake. Every behavior must trace back to
one of:
- the `character_take` line actually being delivered
- the chosen `format_spec.visual_format`'s rules (`format_bibles/{name}.md`)
- the character's own tendencies (`characters/{name}/personality.md` Behavioral
  Tendencies, `visual_personality.md` Signature Physical Habits)

If you can't point to one of those three sources for a movement, cut it.

## Step 0 — Load what this shot needs

- `format_bibles/{visual_format}.md` (skip if null — carousel/story path)
- `characters/{character}/visual_personality.md`
- `content_spec.character_take` — this is what's being delivered; behavior
  should support it, not distract from it (e.g. a punchline lands better with
  a beat of stillness right before it, not constant fidgeting)

## Step 1 — Per-shot breakdown

For each shot (or each carousel slide, using `format_spec.carousel.narrative_progression`
to keep slides connected rather than independent), fill in:
`behavior`, `eye_behavior` (pull from the format bible's Eye Behavior rules),
`micro_movement`, and which part of `character_take` (if any) this shot delivers.

**For video content (any model where `output_granularity: per_content_item`,
e.g. minimax-h3): be specific, not generic.** This is the single most common
way a shot reads as AI-generated instead of a real clip:
- Never write "she smiles" / "she laughs" alone — write the specific physical
  tell: which hand moves where, what the shoulders/nose/eyebrows do. Verified
  real examples: `one hand rising to cover her mouth, nose scrunching,
  shoulders bouncing softly`; `one eyebrow very slightly raised as if daring
  the viewer to guess what's coming`.
- Every pause/beat gets a real number, not "a pause" — `holding a clear beat
  of about 0.8 seconds`, not "she pauses." `model_specs/minimax-h3.md`'s
  Naturalism section documents this as a hard requirement, not a style choice.
- A deliberately held straight-faced/still beat right before a punchline is a
  valid, real technique (builds the joke's timing) — this is different from
  the "avoid complete stillness" rule below, which is about a shot having no
  natural micro-movement at all across its whole duration, not one
  intentional held beat.

## Step 2 — Naturalism check (self-check before handing off)

- Is any shot describing complete stillness for its entire duration (not a
  deliberate pre-punchline hold, but the whole shot)? If so, add a
  micro-movement per the format bible's Movement Rules.
- Are eye behaviors consistent with the format (e.g. `streamer_desk_cam` should
  not have every shot making direct camera contact)?
- For video content: does every named pause have a number attached? Does every
  reaction name a specific physical tell instead of a generic word like
  "smiles"/"laughs" on its own?
- List anything explicitly added purely to avoid stiffness in `naturalism_notes`.

## Output
Fill `enhanced_spec.yaml` (schema: `schemas/enhanced_spec.yaml`).

## On retry (validation_report.retry_layer == prompt_enhancer)
Means naturalism or format-fit failed at the validator — re-check the specific
shot(s) called out in `retry_reason` against the format bible's "Common Failure
Patterns" section first, that's usually exactly what tripped the check.

## Lessons from rendered clips (2026-10-19) — apply before writing
The owner reviewed rendered UGC clips: "structure is good; content boring and missing the character's DNA; Thai sounds odd; dialogue too long so the model distorts."
1. **Short, slow speech:** each phrase <= ~6 Thai words, <= ~15 spoken words per 8 s segment (tighter than the old 24-word cap), clear gaps between phrases.
2. **More shots:** 3-4 shots per segment (~2-2.5 s each), one short phrase per shot or a silent beat — the way TikTok creators record one line, stop, read the next, then cut together. Shots may stay similar or change angle.
3. **Fun, not a lecture:** ask "would viewers rather sit in a classroom or go out and play a game?" — prefer doing/playing/reacting (tiny experiment, game, before/after, prop gag); the character does something with her hands while talking, with real personality/jokes from `characters/<name>/`.
4. **Real spoken Thai:** everyday colloquial wording, not written/academic/formal; avoid the words in `model_specs/thai-dialogue-words.md` that the voice mispronounces (e.g. ไถ -> ปัด, มีด -> ที่โกน).
5. **Camera wording:** never write "a phone-on-a-stand talking video" (the model draws a phone into the frame) — state **shot size and camera height** instead, e.g. "locked-off camera at chest height", "medium close-up, straight on", as the dance prompts do.

## Subject definitions say WHO does WHAT and HOW (owner's rule, 2026-10-19)
`subject_definitions` is not only "which picture is whom". Each subject entry also states its role and what it does through the clip, the way the owner's working workflow prompt does: identity from the picture, then one clause on posture/position, what she holds in which hand, how she speaks.
- Pattern: `<Picture 1> <Name> - <identity as needed>, <outfit if the picture should not decide it>. She is the woman who <role and what she does across the clip: sits upright talking to camera across cuts / walks the hallway / holds the bottle in her right hand at chest height, left hand free>.`
- Props and other subjects get their own entry (`<Picture 2> is a large clear glass bottle ...`) and are tied to the subject that uses them.
- Several people: keep each person's actions and lines attributable. Name them in every shot ("Momo says, ..."), and for speech use the verified `(S1)` / `(S2)` speaker marks (see Dialogue / Speaker Rules); an off-screen speaker needs no picture.
- Keep it consistent with `retention_analysis` and with what the shots show: the subject entry sets the standing role, the shots add the moment-to-moment actions.

## No exaggerated skin / beauty wording (owner rule)
Do not write perfected or glossy skin and beauty words in prompts: no "flawless", "dewy", "glowing / healthy glow", "glass skin", "radiant", "porcelain", "silky", "poreless", "airbrushed", "stunning / gorgeous / perfect". They push the model toward a plastic look. Where skin must be mentioned, keep it plain and realistic (natural matte texture, visible pores, a little natural unevenness) and keep makeup minimal ("soft natural lip tint"). Usually leave skin to the reference picture and name it only in `retention_analysis` as identity retained.
- Character DNA files may contain words like "dewy" or "glow" (e.g. `characters/anong/character_dna.md`, `characters/momo/character_dna.md`): treat them as description of the character, not as wording to copy into the prompt.
- "glow" is fine for light sources (monitor glow, lamp glow, lantern glow); the rule is about skin and beauty.
