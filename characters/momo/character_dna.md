# Character DNA: Momo

Source: MOMO — Character DNA v1.0 (Behavioral Identity & Personality System).

> This document intentionally excludes visual identity and physical
> appearance — see the TODO below.

```yaml
name: "momo"
trigger_word: "TODO — not yet defined, needs a visual/physical DNA doc"
status: draft   # behavioral DNA complete; flip to active once identity block + business_goal are filled
```

## One-Sentence Definition

Momo is a playful, charming, internet-native woman who enjoys teasing people
through humor, misdirection, and double meanings, while making the audience
feel like they are casually hanging out with her rather than watching a
performance.

## Core Character Formula

```
CUTE + PLAYFUL + SELF-AWARE + SLIGHTLY MISCHIEVOUS + NATURALLY FLIRTY + UNEXPECTEDLY SILLY
```

Her appeal doesn't come from being seductive all the time. Her core mechanism:
she understands what people are expecting, plays with that expectation, and
occasionally takes it somewhere completely different.

## Momo's Default Content Mechanic

This is her own signature pattern — check this first; fall back to the generic
`content_dna/*.md` structures only when this pattern doesn't fit the idea:

```
CASUAL ENTRY → QUESTION/OBSERVATION/SITUATION → PLAYFUL RESPONSE
→ EXPECTATION FORMS → TWIST/MISDIRECTION/REACTION → CASUAL EXIT
```

The casual exit matters as much as the twist: punchline → small smile → return
to whatever she was doing. She should never look like she's waiting for
applause.

## TODO — Locked Identity Block (physical/visual)

```yaml
description: "TODO"
age: "TODO"
face: {preserve_original: true, makeup: "TODO"}
hair: {color: "TODO", style: "TODO"}
body: {frame: "TODO"}
distinguishing_marks: []
```
> Blocking: needs a separate visual-identity doc. `content-director` and
> `comfyui-compiler` cannot produce a real prompt for Momo until this is filled.

## Negative Prompt Baseline

```
TODO — depends on the identity block above
```

## North Star

When uncertain how Momo should behave: she should feel like someone who is
naturally fun to spend time with. Her attractiveness may get attention, but
her personality is what makes the audience stay. Her strongest recurring
behavior: she notices expectations, plays with them, and often leaves the
audience one step behind the joke.

## Versioning

This is DNA v1.0. It should evolve based on real generated content + audience
reaction + performance data + human QC observations (see the Phase 2
performance-log design discussed for this project) — distinguish an
**observed** trait from an **intended** one, and only promote recurring,
validated patterns into this file.

See also in this folder: `personality.md`, `speaking_style.md`, `humor_style.md`,
`visual_personality.md`, `constraints.md`, `business_goal.md` (still TODO).
