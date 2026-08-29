---
name: content-request
description: Turns one specific content idea for a named AI-influencer character into a validated, generate-ready ComfyUI prompt (e.g. "อยากได้ content ของ momo แนว streamer reaction กับคลิปเรื่อง..."). Use when the user already gave a specific topic/idea for a character, not just "plan a calendar." Also invoked internally by content-calendar once per day.
---

# Content Request (Entry B) — Single-Item Pipeline Orchestrator

This is the one path every content item goes through, whether it came from a
human's specific ask or from `content-calendar`'s day-by-day loop. It runs the
layers below in order and owns the validation retry loop.

## Pipeline

```
content_input
     │
     ▼
content-director        → content_spec.yaml   (schemas/content_spec.yaml)
     │
     ▼
delivery-format-selector → format_spec.yaml (delivery part)
     │
     ▼
format-router (skip if delivery_format is carousel/story and no single dynamic shot)
     │                  → format_spec.yaml (visual_format part)
     ▼
prompt-enhancer         → enhanced_spec.yaml
     │
     ▼
comfyui-compiler        → compiled_prompt.yaml (one per shot/slide)
     │
     ▼
prompt-validator (run as a subagent, not inline — see below)
     │
  ┌──┴──┐
 PASS  FAIL → reprocess from validation_report.retry_layer, re-running every
  │           layer from there back down to comfyui-compiler, then validate again
  ▼
report result to whoever called this skill (human or content-calendar)
```

## Step 0 — Build/confirm content_input

If invoked directly by a human: confirm character + idea are both present
(`schemas/content_input.yaml`, Entry B fields). If a field the schema needs is
missing (e.g. no platform/delivery format hint), ask once rather than guessing
silently — except `requested_delivery_format`/`platform`, which are allowed to
be null (that's exactly what `delivery-format-selector` exists to decide).

If invoked by `content-calendar`: use the `content_input` it already built —
don't re-ask the user anything the calendar step already confirmed.

## Step 1 — Run the layers

Invoke each layer skill in order via the Skill tool, passing the previous
layer's output forward. Each layer skill is responsible for reading its own
required knowledge files (character DNA, content DNA, format bible, platform
spec, model spec) — this skill just sequences them and carries the schema
objects between steps.

## Step 2 — Validation loop

Invoke `prompt-validator` **as a subagent** (Agent tool), giving it only:
`compiled_prompt.yaml` + the specific DNA/content_dna/format_bible/platform_spec
files that were actually used — never the reasoning trail that produced them.
This is deliberate: a validator sharing context with the layer that just wrote
the prompt tends to grade its own work leniently.

- On `pass: true` → done, hand `compiled_prompt` back to the caller AND write
  the output (Step 3 below).
- On `pass: false` → read `retry_layer`, re-invoke that skill and every skill
  after it in the pipeline order above (never just patch one field in place —
  downstream layers may depend on what changed). Re-validate. Cap at 3 retries;
  if still failing, stop and surface the validation_report to a human instead
  of looping forever.

## Step 3 — Write output

Testing-phase convention (plain files, no Supabase yet): write ONLY the final
compiled prompt as plain text, nothing else for now —

```
content_output/{character}/{date}/item{NN}_compiled_prompt.txt
```

Content of that file is exactly the text that gets pasted into ComfyUI/the
model's UI: for `output_granularity: per_content_item` models (e.g.
minimax-h3), the full structured sections as one text block; for
`per_shot` models (e.g. krea), one file per shot —
`item{NN}_shot{N}_compiled_prompt.txt`.

This is intentionally minimal — once this proves out in real use, expand to
the full `content_spec`/`format_spec`/`enhanced_spec`/`validation_report.yaml`
file set for proper review/debugging trail. Don't build that yet.

## Notes
- This skill owns state for exactly one content item. `content-calendar` runs
  one instance of this per day/item, isolated (see that skill's Step 2).
- Never skip `prompt-validator` to save time, even for a "simple" item — the
  whole point of this pipeline is catching problems before GPU generation, not after.
