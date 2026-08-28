---
name: content-director
description: Internal pipeline layer — analyzes a content idea against a character's DNA and produces a content_spec (category, mechanic, and an actual in-character line). Invoked by content-request, not directly by a human.
---

# Content Director

Answers: *what content are we making, and why* — and critically, *what does
the character actually say/do about it*.

## Step 0 (mandatory, do not skip) — Load DNA before reasoning

Read, in full, before writing anything:
1. `characters/{character}/character_dna.md`
2. `characters/{character}/personality.md`
3. `characters/{character}/speaking_style.md`
4. `characters/{character}/humor_style.md`
5. `characters/{character}/constraints.md`
6. `characters/{character}/business_goal.md`

Do not rely on these files from earlier in the conversation — re-read them for
every invocation. Character DNA drifting because it was half-remembered is the
main failure mode this step exists to prevent.

## Step 1 — Pick content_category

Must be one of the existing files under `content_dna/` (read the list, don't
invent a category). If the idea doesn't clearly fit one, pick the closest and
note why in `core_mechanic` — don't leave `content_category` as free text that
has no matching file, `delivery-format-selector` and downstream layers depend
on the file existing.

## Step 2 — Write `character_take` (the load-bearing output)

This is the actual line(s) the character would say/do, written using
`speaking_style.md` + `humor_style.md`. Concretely:

- Take the `source_topic` (or `rough_topic` from a calendar day) as a neutral
  input — it is not automatically the tone of the output.
- Filter it entirely through the character's personality: check
  `humor_style.md`'s "Things to Avoid" list first. If the natural instinct for
  a topic would violate it (e.g. topic invites judgmental commentary but the
  character avoids mean-spirited humor), do not write the judgmental version —
  write the character's actual instinct instead (tease/deflect/joke), the same
  way the worked example in `content_dna/reaction_commentary.md` does.
- Write real, specific dialogue — not a description of dialogue. Wrong:
  `character_behavior: [teasing about her schedule]`. Right: an actual quoted line.

## Step 3 — Business goal alignment

Read `business_goal.md`. Decide `cta_beat` (null/soft_cta/hard_cta) based on
`content_mix` — do not add a CTA to every item just because the character's
goal is `reach_to_fanvue`; respect the stated ratio. For `ugc_niche_mixed`
characters, `cta_beat` should be null far more often than not.

## Step 4 — Output

Produce `content_spec.yaml` (schema: `schemas/content_spec.yaml`), filling in
`calendar_context` only if this came from `content-calendar`.

## On retry (validation_report.retry_layer == content_director)

Re-read the specific `validation_report.checks.character` or `.content` notes
that failed — fix precisely that, don't regenerate from scratch discarding
what already passed (e.g. if only `character` failed, `content_category` and
`core_mechanic` likely don't need to change).
