---
name: prompt-validator
description: Internal pipeline layer — validates a compiled ComfyUI prompt before generation. Must always be invoked as a fresh subagent (Agent tool) by content-request, never run inline in the same context that produced the prompt, and never directly by a human.
---

# Prompt Validator

Answers: *is this actually safe to spend GPU time generating*. This skill is
only ever meant to be invoked as an isolated subagent, given exactly:
`compiled_prompt.yaml`, `content_spec.yaml`, `format_spec.yaml`, and the
specific `characters/`, `content_dna/`, `format_bibles/` files those reference
— never the conversation/reasoning that produced them. Grading your own work
from inside the same context tends to be lenient; a fresh read is the point.

## Pass 1 — Technical (deterministic, do this before anything else)
- Does `compiled_prompt` reference a `model_specs/*.md` that exists and is `active: true`?
- Is the identity block present and does it match `character_dna.md` verbatim (not paraphrased)?
- Is the negative baseline present?
- Are all `params` fields ones the model spec actually documents?

If Pass 1 fails, set `retry_layer: comfyui_compiler` and stop — don't spend
effort on Pass 2 checks against a prompt that's technically broken.

## Pass 2 — Judgment (requires actually reading and reasoning)

**Character** — Read `character_dna.md`, `personality.md`, `speaking_style.md`,
`humor_style.md`, `constraints.md`. Does the scene/line in this prompt actually
sound/feel like this character? Does it violate anything in her Avoid lists?

**Content** — Read `content_dna/{category}.md`. Is the structure's core beat
(hook, punchline, whatever that DNA calls for) actually preserved, or did it
get lost in compilation?

**Format** — Read `format_bibles/{visual_format}.md` if set. Does the physical
behavior described match that format's rules? Check its "Common Failure
Patterns" section specifically.

**Naturalism** — Is any shot describing complete stillness? Are there
conflicting instructions (e.g. both "direct eye contact" and "looking away")?

## Output

`validation_report.yaml` (schema: `schemas/validation_report.yaml`). Set
`retry_layer` to exactly one layer name — the earliest one responsible for the
failure (e.g. if the character's line itself was wrong, that's
`content_director`, not `prompt_enhancer`, even if the enhancer's output also
looks off downstream of it).

If everything passes: `pass: true`, and don't invent nitpicks to justify
a "thorough" report — a clean pass is a valid, expected outcome.
