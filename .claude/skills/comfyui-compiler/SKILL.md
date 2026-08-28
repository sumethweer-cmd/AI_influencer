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
- `model_specs/{active model, the one with active: true}.md`
- `platform_specs/{platform}.md` if set (for any technical params the model
  spec says come from platform, e.g. aspect ratio)

## Step 1 — Compile

Positive prompt = character's locked identity block (verbatim, first) +
`enhanced_spec.scene_description` phrased per the model spec's syntax rules
(weighted tokens, tag style, whatever that file documents — don't invent
syntax it doesn't mention).

Negative prompt = character's negative baseline (verbatim) + anything shot-specific.

`params` = only fields the active model_spec actually documents as required.
Do not add `aspect_ratio`/resolution unless the model spec says to — that's
configured in ComfyUI itself per the original design note.

One `compiled_prompt.yaml` per shot/slide — never merge multiple shots into one file.

## Step 2 — Self-check (deterministic, before handing to validator)
- Does the model_spec marked `active: true` actually exist? If not, stop and
  say so rather than guessing at syntax.
- Is the identity block copied verbatim (not paraphrased) from `character_dna.md`?
- Is the negative baseline present in full?

## Output
`compiled_prompt.yaml` (schema: `schemas/compiled_prompt.yaml`), one per shot.

## On retry (validation_report.retry_layer == comfyui_compiler)
Usually a technical/syntax issue — check `checks.technical.notes` first, it's
the deterministic pass and should say exactly what's wrong (missing field,
bad syntax for the active model, etc.).
