---
name: delivery-format-selector
description: Internal pipeline layer — decides what kind of deliverable a content item should be (image set, carousel, video clip/reels, or story) based on its goal and platform. Invoked by content-request, not directly by a human.
---

# Delivery Format Selector

Answers: *what are we actually shipping* — distinct from Format Router, which
answers *how the camera/body looks*. This layer runs first because its output
changes what Format Router even needs to do.

## Inputs
`content_spec.yaml` (from content-director), `content_input.platform` (may be null).

## Decision Guide

| content_goal | typical fit |
|---|---|
| engagement (existing followers) | image_set+caption, carousel, story |
| reach (new audience) | video_clip (reels/shorts) — algorithms favor video for reach |
| conversion / cta_beat != null | video_clip or image_set with a clear CTA moment |

Also weight `characters/{character}/visual_personality.md`'s Format Fit
section — some characters suit carousel-driven content better than video, or
vice versa, independent of the goal.

If `content_dna.core_mechanic` implies a sequence (e.g. `storytelling.md`,
GRWM-style before/mid/after), lean toward `carousel` or `video_clip` over a
single image — a one-shot image can't carry a progression.

If `platform` is known, check `platform_specs/{platform}.md` — e.g. Pinterest
leans `image_set` by convention even for reach goals.

## If delivery_format == carousel

Set `carousel.slide_count`, and critically: define `continuity_seed` and
`narrative_progression` now, before Format Router or Prompt Enhancer run. Every
slide in this carousel must later share the same seed/reference and continue
one narrative beat-to-beat — this is not N independent single-image pipelines.

## Output

Fill the `delivery_format`/`delivery_format_reason`/`carousel` fields of
`format_spec.yaml` (schema: `schemas/format_spec.yaml`). Leave `visual_format`
null — that's Format Router's field, filled next (skip Format Router entirely
if `delivery_format == story` and the content is a simple static/text story
with no dynamic shot).

## On retry (validation_report.retry_layer == delivery_format_selector)

This almost always means the chosen format doesn't fit the content_spec (e.g.
a story-driven idea was forced into a single image) — re-check the Decision
Guide above rather than just changing platform assumptions.
