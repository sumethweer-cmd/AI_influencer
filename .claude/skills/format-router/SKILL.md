---
name: format-router
description: Internal pipeline layer — a deterministic lookup that picks which format_bibles/*.md (camera/body/movement style) fits a content item. Invoked by content-request, not directly by a human.
---

# Format Router

Answers: *how should this physically appear on camera* — this is a lookup, not
open-ended creative reasoning. Keep the decision deterministic and traceable to
the table below; don't invent a new visual_format on the fly.

## When this layer is skipped
If `format_spec.delivery_format` is `carousel` or `story`, this layer usually
does not apply (carousels need per-slide framing decided in `prompt-enhancer`
directly against `carousel.narrative_progression`, not a single format bible).
Only run this layer for `video_clip` and single-shot `image_set` items.

## Lookup Table

| core_mechanic / content_category | character Format Fit (visual_personality.md) says avoid it? | → visual_format |
|---|---|---|
| streamer_reaction, opinion (screen-reaction framing) | — | `streamer_desk_cam` |
| comedy with a POV/joke structure | — | `pov_comedy` |
| ugc, product_review (outfit as subject) | — | `tripod_outfit_review` |
| ugc (task-based, e.g. routine) | — | `grwm` |
| flirty, fan_interaction (direct/personal) | — | `selfie_cam` or `mirror_selfie` |
| opinion, storytelling (general talking-to-camera) | — | `tripod_casual` |
| storytelling, opinion (benefits from scenery change) | — | `walk_and_talk` |

If the character's `visual_personality.md` "Format Fit → Avoid" list rules out
the table's default pick, choose the next-best fit from that same file's
"Suits well" list rather than improvising a new format.

## Output
Fill `format_spec.visual_format` (schema: `schemas/format_spec.yaml`).

## On retry (validation_report.retry_layer == format_router)
Means the chosen format's physical behavior didn't match what the validator
expected (e.g. static desk-cam picked for content that needed movement) —
re-check the lookup table row, don't just re-roll randomly.
