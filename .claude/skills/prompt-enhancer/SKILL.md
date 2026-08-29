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

## Step 2 — Naturalism check (self-check before handing off)

- Is any shot describing complete stillness for its entire duration? If so, add
  a micro-movement per the format bible's Movement Rules.
- Are eye behaviors consistent with the format (e.g. `streamer_desk_cam` should
  not have every shot making direct camera contact)?
- List anything explicitly added purely to avoid stiffness in `naturalism_notes`.

## Output
Fill `enhanced_spec.yaml` (schema: `schemas/enhanced_spec.yaml`).

## On retry (validation_report.retry_layer == prompt_enhancer)
Means naturalism or format-fit failed at the validator — re-check the specific
shot(s) called out in `retry_reason` against the format bible's "Common Failure
Patterns" section first, that's usually exactly what tripped the check.
