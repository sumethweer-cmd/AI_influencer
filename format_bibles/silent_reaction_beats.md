# Format Bible: Silent Reaction Beats

Source: real production brief ("CHARACTER PERFORMANCE" — No/No/No/No/Yes
reaction-to-numbers brief, 2026-09-01). For content built around discrete,
numbered reaction beats to on-screen items (numbers, stats, options, etc.)
that get composited in during editing — the model must never speak, never
render any text/graphics itself, and must read as reacting to something
just off-lens, not performing to camera.

```
Camera:
- Fixed tripod-style framing, steady, body position stable across the
  whole sequence — no walking/re-blocking between beats
- Multiple shots, one per reaction beat, cutting cleanly between them
  (matches microphone_talk's multi-shot convention, not a continuous take)

Eyes:
- NEVER at the lens unless the brief explicitly calls for it — gaze goes
  toward the implied off-screen item (down/to the side, wherever the
  overlay will sit), since eye contact reads as "talking to the audience"
  and this format is "reacting to a thing," not addressing anyone
- On a positive/payoff beat, gaze may lift toward the lens briefly if the
  brief calls for a "let the audience in on it" moment — otherwise default
  off-lens throughout

Dialogue:
- NONE. No <d> tags, no speech, no lip movement suggesting speech. This is
  a fully silent physical-performance format — every beat is built purely
  from expression/head motion/posture, described without any dialogue line

On-screen content:
- Never describe or render text, numbers, symbols, or graphics in the
  prompt — those are composited in post-production over the reaction. The
  prompt only describes what SHE does in reaction to an implied item,
  never the item itself

Body:
- Small, natural, readable head/facial motion — a head shake, a nod, a
  smile forming — not exaggerated theater-kid gestures
- No pointing, no hand gestures indicating the item (that's for a
  different content type) — the reaction is carried by head and face alone
- Body position/framing stays constant across every beat so a viewer can
  cut between them cleanly without a jarring re-frame

Pacing:
- One clean, distinct reaction per beat, with a genuine numeric-duration
  pause between beats (per model_specs/minimax-h3.md's hard requirement)
- Repeated beats (e.g. four "no" reactions in a row) should each be
  distinct in micro-detail (slightly different head-shake speed/amplitude,
  small posture shift) even though the core gesture repeats — otherwise it
  reads as the same clip looped, not four separate genuine reactions
- The payoff beat (the "yes"/positive reaction) should read as a clear
  tonal shift — a brief pause before it lands sells the anticipation the
  repeated "no" beats built
```

## Common Failure Patterns
- Any dialogue or lip movement — this format is 100% silent by design;
  even a small "mm" or exhale-with-mouth-movement breaks the "text gets
  overlaid, she doesn't talk" premise.
- Describing the on-screen number/text/graphic itself in the prompt —
  it doesn't exist yet at generation time; describing it invites the
  model to try to render it (badly).
- Making all the repeated "no" beats read as identical (copy-pasted
  description) — even a same-gesture beat needs its own specific physical
  detail so four beats feel like four separate genuine reactions.
- Skipping the numeric pause between beats because "there's no dialogue
  here" — the hard-requirement rule applies to every beat/pause regardless
  of whether it carries a line.

## Best Suited For
`reaction_commentary` (silent variant), `opinion`-adjacent — sequential
reaction/verdict content where the actual items being reacted to are
added in post (numbers, poll options, product photos, etc.), not spoken
by the character.
