# Format Bible: POV Q&A Reaction

Source: real production brief (revision of the "No/No/No/No/Yes" silent
reaction concept, 2026-09-01, now with an off-screen male voice asking the
questions). Combines `pov_comedy.md`'s camera-is-a-person convention with
`silent_reaction_beats.md`'s discrete-numbered-beat structure — the
difference from that file is the two things it explicitly forbids
(dialogue, direct eye contact) are exactly what this variant requires.

```
Camera:
- POV — the camera IS the off-screen male character (S2). He is never
  seen, never gets a <Picture N> reference (per model_specs/minimax-h3.md:
  an off-screen second speaker never needs a Picture reference if he stays
  off-screen the whole clip)
- Fixed/steady framing, one cut per beat, same as silent_reaction_beats

Eyes:
- OPPOSITE of silent_reaction_beats: she looks at the lens throughout,
  because the lens IS the person she's responding to — per pov_comedy.md,
  "Direct to lens = looking at the implied other person." Looking away
  would break the POV conceit here, not preserve it.

Dialogue:
- (S2), the off-screen male, asks/states each item as a real spoken line
  — numbers are said aloud, not shown as on-screen text/graphics (unlike
  silent_reaction_beats, where they're composited in afterward)
- Anong (S1) reacts physically and silently to each stated item except
  the final beat, where she delivers the punchline line herself
- Every line — his and hers — still needs pacing description and a
  numeric-duration pause around it, same hard requirement as any other
  H3 item

Body:
- Same restrained, natural, readable reaction language as
  silent_reaction_beats for the repeated "no" beats (head-shake, no
  pointing, no exaggerated gestures)
- The final beat is played toward the camera-as-person specifically — a
  playful, slightly flirty delivery toward "him," not toward a general
  audience

Pacing:
- Same beat structure as silent_reaction_beats: repeated near-identical
  reactions (each with distinct micro-detail) building anticipation
  toward a distinct final tonal shift
- The second-to-last beat is HIS question, not her reaction — give it its
  own beat/shot rather than folding it into the reaction before or after
```

## Common Failure Patterns
- Looking away from the lens during her reactions — that reads as
  ignoring the person she's supposedly responding to, breaking the POV
  premise this format depends on (the opposite problem from
  `silent_reaction_beats.md`, so don't default to that file's eye rule
  out of habit).
- Giving the off-screen male a `<Picture N>` reference — he's POV/never
  seen, exactly like the off-screen friend pattern in
  `model_specs/minimax-h3.md`.
- Writing the spoken numbers as on-screen text/graphics instead of actual
  `<d>` dialogue lines — in this variant they're said aloud, not
  composited in post.

## Best Suited For
`reaction_commentary`, `flirty` — playful Q&A/interview-style bits where
an unseen interviewer (voiced via S2) feeds items to react to, building to
a punchline she delivers herself, addressed to him/the lens.
