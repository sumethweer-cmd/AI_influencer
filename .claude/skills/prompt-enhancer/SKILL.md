---
name: prompt-enhancer
description: Internal pipeline layer — adds natural physical behavior (micro movement, eye behavior, timing) to a content item so it doesn't read as stiff/posed. Invoked by content-request, not directly by a human.
---

# Prompt Enhancer

Answers: *how does this scene actually move and breathe* — turns
`content_spec` + `format_spec` into a fully described scene.

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
