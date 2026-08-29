---
name: content-calendar
description: Plans a multi-day content calendar for a named AI-influencer character (e.g. "ขอ content calendar momo หน่อย", "plan this week for momo"). Use when the request is broad — a character and a time period, with no specific topic/idea already given. If the user already gave a specific content idea and format, use content-request instead, not this skill.
---

# Content Calendar (Entry A)

This is the top-level planning layer. It does NOT write any prompts itself —
it produces a day-by-day plan, then hands each day to `content-request` to run
the full pipeline.

## Step 0 — Identify the character and confirm scope

1. Read `characters/{name}/business_goal.md` and `characters/{name}/personality.md`.
   If the character folder doesn't exist, stop and say so — never invent DNA.
2. If the user didn't say how many days (`content_input.days_requested`),
   default to 7 but confirm before generating anything.
3. If `week_theme`/`occasion` wasn't given, ask once — don't assume a theme.

## Step 1 — Decide the week's shape (not yet full content)

For each day, decide only:
- `content_goal`: engagement | reach | conversion (informed by `business_goal.md`)
- `rough_topic`: one line, not a full idea yet
- Whether this day leans `reach_to_fanvow`-style CTA or stays niche/organic —
  per `business_goal.content_mix`, don't put a CTA on every day even for a
  funnel-focused character.

Vary content_goal and rough_topic across the week — don't repeat the same
goal/topic pattern every day, the same way a real creator's week isn't one
note repeated 7 times.

**Show this table to the user and get confirmation before Step 2.** Generating
a full week of compiled prompts is expensive to redo — a wrong calendar shape
caught here saves reprocessing 7 full pipeline runs.

```
Day | content_goal | rough_topic
1   | engagement   | ...
2   | reach        | ...
...
```

## Step 2 — Run content-request once per day

For each confirmed day, build a `content_input` with:
```yaml
entry_point: content_request
character: {name}
content_idea: "{rough_topic}"
constraints: []
```
and invoke the `content-request` skill for it, **as a separate subagent per
day** (via the Agent tool) — this keeps each day's context isolated so DNA/
format-bible/model-spec text doesn't accumulate and bloat context across 7
runs. Pass the day's `content_goal` and `calendar_context: {day, week_theme}`
alongside the content_input.

## Step 3 — Report back

Once all days are done, summarize what was produced per day (delivery_format,
visual_format if any, pass/fail from validation) — don't dump every compiled
prompt inline, point to where the files/outputs live.

## Notes
- This skill never talks to Format Router, Prompt Enhancer, etc. directly —
  that's `content-request`'s job, always through the same single path
  regardless of entry point.
- If the user's request already contains a specific idea ("streamer reaction
  about..."), that's `content-request`'s trigger, not this one — don't run a
  calendar plan around a single already-specified idea.
