# Format Bible: Microphone Talk

Source: real production brief ("ANONG — MICROPHONE TALK SERIES", 2026-08-30).
Distinct from `tripod_casual.md`: that format is one continuous take;
this one is a multi-shot edit that cuts on every line/beat, built around a
handheld prop mic, closer to a creator "vlog interview" than a static talk.

```
Camera:
- Tripod-mounted, NOT selfie/handheld — the character is at a small
  distance from the camera, not holding the phone herself
- Multiple shots per content item, cutting on sentence/beat boundaries
  (medium shot / medium close-up / close-up / side angle), not one
  continuous static frame
- Level, steady between cuts — no handheld shake (that's selfie_cam's job)

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

## Best Suited For
`flirty`, `fan_interaction` — short, punchy direct-audience-address
content built around a question → build → payoff arc across several
short lines, not a single long monologue.
