---
name: character-dna-builder
description: Step 0 of the pipeline — interviews a user to build a brand-new AI-influencer character from scratch, then generates the full character file set (character_dna.md, personality.md, speaking_style.md, humor_style.md, visual_personality.md, constraints.md, business_goal.md) that content-director and the rest of the pipeline read. Triggers "create a new character", "สร้างตัวละครใหม่", "build me an AI influencer", "I want to make a character like Anong/Momo", or any request to start a character from nothing. Do not use this to edit an existing character — only to originate a new one.
---

# Character DNA Builder

Turns "I want to make an AI influencer" into the 7 files every other skill in
this pipeline depends on. Run this once per new character, before
`content-director`/`content-request` are ever invoked for them.

## Why this exists

`content-director` has a hard "Step 0" rule: read all 6 character files in
full before reasoning about any content idea, every single time. Those files
have to exist and follow a consistent schema, or every downstream skill
(`prompt-enhancer`, `comfyui-compiler`, `format-router`) breaks or improvises.
This skill is what produces those files the first time, from a plain
conversation with the user — no schema knowledge required on their end.

## Output

Creates `characters/{slug}/`:
- `character_dna.md` — identity block (face/hair/skin/body), trigger word, core archetype, default content mechanic, negative prompt baseline
- `personality.md` — personality balance, audience relationship
- `speaking_style.md` — language, tone, pronoun, example lines
- `humor_style.md` — what kind of playful/funny she is, things to avoid
- `visual_personality.md` — style palette, sexy/visual level, default aesthetic, prompt-enhancer guidance
- `constraints.md` — hard boundaries, sfw/nsfw flags, hard avoid list
- `business_goal.md` — monetization goal, funnel structure, KPI framing

`characters/TEMPLATE/` holds the blank schema (`{{placeholder}}` fields) for
all 7 files — copy its structure section-for-section, filling placeholders
from the interview. Cross-check against the two filled examples
(`characters/anong/`, `characters/momo/`) when a placeholder's expected
shape isn't obvious from TEMPLATE alone (e.g. what a filled-in funnel
structure or a Locked Identity Block actually looks like). Do not invent new
top-level sections; downstream skills only read the sections that already
exist in these files.

## Step 1 — Interview the user

Ask in plain conversation, not a rigid form — but make sure you get an
answer (explicit or a reasonable stated assumption) for each of these before
writing anything. Group related questions together rather than asking one
at a time when the user is clearly ready to give a lot of detail at once.

**A. Identity basics**
1. Name (and a `trigger_word` — the exact token that must open every
   positive prompt; ask if they want it stylized like Momo's `m0m0` or plain
   like Anong's `anong`)
2. Age (stated in-universe age, not a real person's)
3. Primary language for dialogue/captions (Thai, English, other)

**B. Physical identity block** (this becomes the Locked Identity Block —
reused verbatim in every generated prompt, so get real specificity, not
vague adjectives)
4. Face: shape, eyes, nose, mouth, makeup style
5. Hair: color, style/length
6. Skin: tone, texture
7. Body: build/frame, any specific proportions they want locked
8. Any distinguishing marks (tattoo, mole, etc.) — and explicitly confirm
   "no other marks anywhere" as a negative constraint if they name one,
   same pattern as Momo's tattoo lock
9. Do they have reference images? (If yes: note that image references are
   handled at generation time via `<Picture N>` tags, not encoded in
   these text files — this skill only captures the *text description*.)

**C. Personality & voice**
10. In one sentence, who is she? (their own words — this becomes the
    One-Sentence Definition / Core Essence)
11. Pick 3-5 personality traits and rough weights (e.g. "30% playful, 20%
    warm..." like Anong's Personality Balance) — offer a short list to
    choose from if they're stuck: playful, warm/affectionate, curious,
    educator, flirty, mischievous, sarcastic, chaotic, deadpan, nurturing
12. What's her sense of humor? Give an example joke/line if they can.
13. Tone/register: casual or polished? What pronoun/address style (if
    Thai)? Any signature phrases she'd actually say?
14. Explicitly ask: what should she NEVER sound like / never do? (This
    feeds both `humor_style.md`'s Things to Avoid and `constraints.md`)

**D. Visual style**
15. Style palette / aesthetic (colors, vibe — soft/natural vs bold/glam vs
    edgy, etc.)
16. How sexy/visually bold is she, on a spectrum, and where's the locked
    ceiling? Use Anong's "LOOK SEXY ≠ ACT SEXUAL" framing as a prompt: does
    her outfit/visual packaging carry attention while her behavior stays
    separate, or is she a different kind of character entirely (e.g. not
    sexy-coded at all — cute, edgy, sporty)? Don't assume sexy-coded by
    default — ask.
17. Default settings/environments she's usually shown in

**E. Business goal & funnel** — this is the field most students will
under-think; push for a real answer, don't let it default to "just make
content":
18. What is she actually monetizing? (affiliate/UGC commerce, subscription
    platform like Fanvue/Patreon, brand sponsorship, pure reach/ad-share,
    something else)
19. Given that goal, walk them through funnel staging using the two
    existing patterns as reference points, and ask which shape fits:
    - **Anong's shape** (3 stages, WITH a trust-building middle stage):
      reach/entertainment → education/trust-building → hard CTA — fits
      when monetization depends on the audience believing a claim (product
      efficacy, expertise, recommendation).
    - **Momo's shape** (3 stages, WITHOUT a trust-building stage): reach
      via comedy → visual/outfit eye-hook (no CTA) → hard CTA — fits when
      monetization is about fandom/attraction/support, not a claim needing
      credibility.
    - Or a genuinely different shape — don't force-fit if neither matches.
20. **Content boundary — ask this one before anything else in section E,
    and never infer or default it.** This pipeline teaches prompt-engineering
    technique; it does not dictate what the person building this character
    chooses to create. So ask directly, in this order:
    - First, read `characters/CONTENT_HARD_LIMITS.md` yourself if you
      haven't this session, and relay its 4 rules to the user in your own
      words before asking anything else: no minors ever (character must be
      a genuine, stated adult — not youth-coded regardless of what else is
      allowed), no real-person likeness, no non-consensual/violent sexual
      content, and any NSFW content must stay gated to a platform that
      actually permits it (never a reach platform like TikTok/IG/FB/
      YouTube). Make clear these 4 don't change no matter what they answer
      next.
    - Then ask plainly: `nsfw_allowed` — yes or no for this character?
    - If yes: what's the default level when NSFW is generated (suggestive/
      implied only, vs. nude, vs. explicit)? And under what condition does
      the most explicit tier actually get generated — e.g. only when
      explicitly requested per content item, never as this character's own
      default? (Same pattern as `characters/momo/constraints.md`'s
      `nsfw_default_level`/`nsfw_explicit_override` fields — read that file
      for the exact shape before writing this character's own.)
    - If no: confirm `sfw_default: true` and move on — same as Anong's file.

## Step 2 — Confirm before writing

Summarize what you heard back in a short block (identity, personality
weights, funnel shape, boundaries) and ask the user to confirm or correct
before generating files. This is the same "confirm understanding before
building" discipline used elsewhere in this pipeline — cheap to check now,
expensive to unwind after 7 files are written and content has been built on
top of a wrong assumption.

## Step 3 — Generate the 7 files

Write `characters/{slug}/` with all 7 files, matching Anong/Momo's schema
section-for-section. Concretely:

- Mark `status: draft` in `character_dna.md`'s yaml block (not `active`) —
  the user should flip it to `active` themselves once they've sanity-checked
  the files, same convention Momo's file uses while still being filled in.
- Write the Locked Identity Block as concrete yaml (face/hair/skin/body/
  distinguishing_marks), not prose — it gets reused verbatim across every
  shot downstream, so ambiguity here compounds into every future prompt.
- Every claim/boundary the user was vague about: write your best default
  and flag it inline as an assumption (`> Assumption: ...`), the same
  pattern used throughout Anong/Momo's own files (e.g. visual_personality's
  "Format Fit — TODO" section) — never silently invent a hard constraint
  like `nsfw_allowed` without an explicit user answer for that one field
  specifically.
- `constraints.md`'s Content Boundaries section must open with a reference
  line to `characters/CONTENT_HARD_LIMITS.md` (copy the exact reference
  line from `characters/anong/constraints.md` or `characters/momo/
  constraints.md`), then the `nsfw_allowed`/`nsfw_default_level`/
  `nsfw_explicit_override` yaml block from Step 1 question 20's answers.
  Never write this section without that reference line — it's what makes
  the 4 hard limits visible to anyone reading this specific character's file
  later, not just to whoever ran this interview.
- `business_goal.md`: write out the funnel stages explicitly (goal →
  stage 1/2/3 → content/platform/CTA per stage), not just a label, matching
  the level of detail in `characters/momo/business_goal.md`'s "Funnel
  Structure" section.

## Step 4 — Hand off

Tell the user the character is ready, name the folder, and tell them the
next step is `content-request` (single idea) or `content-calendar` (a
content plan) — both will now find and read these files automatically by
the character slug/name.

## Anti-patterns

- Do not skip straight to writing files from a one-line request ("make me a
  sexy streamer character") — that produces a shallow, generic DNA file
  that every downstream skill then has nothing real to work from. Interview
  first.
- Do not silently default `nsfw_allowed` or any hard boundary field —
  always get an explicit answer for content boundaries specifically.
- Do not invent a funnel/monetization goal the user didn't state — ask, or
  leave `business_goal.md` explicitly marked TODO with the gap called out,
  same as Momo's file did while it was incomplete.
- Do not copy Anong or Momo's actual traits/lines into a new character "as
  a starting point" — their files are named references for *schema*, not
  content to reuse.
