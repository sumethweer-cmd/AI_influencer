---
name: comfyui-compiler
description: Internal pipeline layer — compiles an enhanced scene description into a model-specific, generate-ready ComfyUI prompt. Invoked by content-request, not directly by a human.
---

# ComfyUI Prompt Compiler

Answers: *how do we say this to the current model* — templating against a
documented model spec, not free reasoning. This layer must not change creative
intent; if `enhanced_spec` seems to need a change to work, that's a validator
finding to send back upstream, not something to quietly alter here.

## Step 0 — Load

- `characters/{character}/character_dna.md` (Locked Identity Block + Negative
  Prompt Baseline — copy verbatim, never paraphrase)
- The right `model_specs/*.md` for this item's `format_spec.delivery_format`:
  video content (`video_clip`) and still-image content (`image_set`,
  `carousel`, `story`) use **different** active models — more than one
  `model_specs/*.md` can be `active: true` at once, scoped to different
  output types. Pick the one whose scope matches this item's delivery
  format; if more than one matches or none do, stop and ask rather than guessing.
- `platform_specs/{platform}.md` if set (for any technical params the model
  spec says come from platform, e.g. aspect ratio)

## Step 1 — Compile

Read the chosen model_spec's own framing note for `output_granularity`
(`schemas/compiled_prompt.yaml`) — some models (classic image-diffusion
checkpoints) want one `compiled_prompt.yaml` per shot/slide; others
(structured multi-shot models like `minimax-h3`) want ONE per content item
with shots embedded via that model's own notation. Follow whichever the
model_spec says — don't default to "per shot" if the model doesn't want that.

**Shape A (per-shot, image-diffusion style):** positive prompt = character's
locked identity block (verbatim, first) + `enhanced_spec.scene_description`
phrased per the model spec's syntax rules. Negative prompt = character's
negative baseline (verbatim) + anything shot-specific.

**Shape B (structured, e.g. minimax-h3):** fill `structured_sections` using
exactly the section names/order that model_spec documents (e.g.
`subject_definitions`/`summary`/`retention_analysis`/
`integrated_multimodal_description`/`overall_soundscape`/`non_diegetic_music`
for minimax-h3) — all of `enhanced_spec`'s shots go into the one relevant
section (e.g. `integrated_multimodal_description`'s `[Shot N]` markers), not
split across files.

`params` = only fields the model_spec actually documents as required. Do not
add `aspect_ratio`/resolution unless the model spec says to.

## Step 2 — Self-check (deterministic, before handing to validator)
- Does the chosen model_spec actually exist and match this item's delivery format? If not, stop and say so rather than guessing at syntax.
- Is the identity block copied verbatim (not paraphrased) from `character_dna.md`?
- For Shape A: is the negative baseline present in full? For Shape B: are all required sections present, in the model's documented order?

## Output
`compiled_prompt.yaml` (schema: `schemas/compiled_prompt.yaml`), granularity per `output_granularity`.

## On retry (validation_report.retry_layer == comfyui_compiler)
Usually a technical/syntax issue — check `checks.technical.notes` first, it's
the deterministic pass and should say exactly what's wrong (missing field,
bad syntax for the active model, etc.).
