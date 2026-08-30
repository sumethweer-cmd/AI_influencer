# Format Bible: Microphone Talk

Source: real production brief ("ANONG — MICROPHONE TALK SERIES", 2026-08-30).
Distinct from `tripod_casual.md`: that format is one continuous take;
this one is a multi-shot edit that cuts on every line/beat, built around a
handheld prop mic, closer to a creator "vlog interview" than a static talk.

```
Camera:
- Tripod-style framing, NOT selfie/handheld — the character is at a small
  distance from the camera, not holding the phone herself
- Multiple shots per content item, cutting on sentence/beat boundaries
  (medium shot / medium close-up / close-up / side angle), not one
  continuous static frame
- Level, steady between cuts — no handheld shake (that's selfie_cam's job)
- **"Tripod" describes the camera's own steadiness, never an object in the
  shot.** Only use "tripod"/"tripod-mounted" in the overall style sentence
  of `detailed_description` (e.g. "fixed tripod-style shot"), which the
  model reads as a cinematography instruction. Never put "tripod" or
  "tripod-mounted camera" inside the character's own `subject_definitions`
  line — that reads as a description of what's *in the scene*, and risks
  the model rendering a literal tripod object next to her. Describe her
  there as simply "speaking directly to the camera across multiple cuts,"
  not naming the mounting hardware at all.

Prop:
- Small Bluetooth microphone, held in one hand throughout — carries
  continuously across every shot in a content item like an outfit does

Body:
- Casual creator energy, not a photoshoot pose
- Small naturalistic blocking beats are fine (a step in, a slight turn,
  offering the mic toward the lens) but each shot itself stays mostly
  still with only natural micro-movement, matching H3's naturalism bar

Eyes:
- NOT constant direct-to-camera — this format deliberately varies gaze:
  mid-thought lines look slightly off to the side, direct eye contact is
  reserved for the punchline/payoff line landing with more impact
- Punchline shots: direct, clear eye contact with the lens

Pacing:
- Short sentences, not long run-on lines — matches the source brief's
  "ไม่ต้องพูดเร็ว, แต่ละประโยคสั้น"
- A genuine micro-pause between sentences/shots, not just at the end
- Expression/tone shifts per line to track the emotional beat of that line

Lighting:
- Soft ambient room/daylight, whatever suits the stated setting per item

Avoid:
- Every single shot posed dead-center staring at the lens (that reads as
  fashion photography, not a creator talking to their audience)
- Rushed, monotone delivery across all lines
```

## Common Failure Patterns
- Treating this like `tripod_casual` (one continuous take) instead of a
  real multi-shot edit with `[Shot N]` cuts on sentence boundaries.
- Forgetting the mic prop needs its own `<Picture N>` reference and must
  stay `fully_preserved` across every shot, same as outfit.
- Direct-to-camera eye contact on every single shot instead of reserving
  it for punchlines — flattens the "talking to camera vs. thinking aloud"
  distinction the source brief explicitly calls for.
- Naming "tripod"/"tripod-mounted camera" inside the character's own
  `subject_definitions` line instead of only in the overall style
  sentence — risks a literal tripod rendering in frame (found in the first
  batch of this series, corrected 2026-08-30).
- Cutting a new `[Shot N]` for every single short line even when several
  lines belong to the same emotional beat — a 5-line item doesn't need 5
  shots; merge lines that build toward the same beat into one shot and cut
  only at real structural turns (setup → pivot → payoff), or the edit
  reads as frantic rather than natural.

## Best Suited For
`flirty`, `fan_interaction` — short, punchy direct-audience-address
content built around a question → build → payoff arc across several
short lines, not a single long monologue.
