# Format Bible: Candid Activity Glimpse

Source: real reference reel (IG, "pearreland" — girl bent over feeding a
cat, loose t-shirt neckline gapes briefly as she leans forward; 1,093
comments / 1,482 reshares / 7,492 saves on a single clip with zero
dialogue). The defining trait: the camera is fixed and silent, she's
absorbed in an ordinary task, and the "hook" is a brief, physics-accurate
wardrobe shift caused by her own natural movement — never posed, never
acknowledged, never lingered on.

```
Camera:
- Fixed tripod or propped phone, NOT handheld — same steadiness as
  candid_single_take.md
- Positioned at a slight downward or level angle toward where she'll bend
  (e.g. floor-level activity, low table, pet at floor height) so the
  lean-forward motion reads naturally in frame, not staged for the angle
- Medium shot, waist-up to full-body depending on the activity — wide
  enough to show the whole motion of bending, not a tight crop that makes
  the framing itself look intentional

Eyes:
- NEVER looks at the lens — same hard rule as candid_single_take.md.
  She is absorbed in the task the entire time. Any glance at camera
  destroys the "just caught on camera" premise this format depends on.

Body / The Mechanic:
- She is doing one continuous, ordinary physical task that requires
  bending or leaning forward (feeding/petting an animal, picking
  something off the floor, tying a shoe, organizing a low shelf/drawer,
  wiping something up) — the task must be mundane and self-contained,
  never framed as being "for the camera"
- The wardrobe interaction is described as a PASSIVE, PHYSICS-DRIVEN
  consequence of the lean, not a deliberate reveal: the garment's own
  looseness/neckline shifts away from the body BECAUSE of gravity and
  the forward angle, not because it's tight or "falls open" — the
  distinction matters, physics-driven reads natural, deliberate reads
  posed
- The glimpse is BRIEF and RESOLVES: describe it appearing as she leans
  in, then settling/closing back as she straightens or shifts weight —
  never described as staying open, never lingered on for the rest of
  the shot
- Keep the actual glimpse description understated and matter-of-fact
  (what the fabric does, not what is or isn't visible) — let the
  camera framing and duration do the work rather than explicit detail

Movement:
- Small idle physical business throughout the task (adjusting grip,
  brushing hair back, shifting weight between a kneel and a crouch) —
  same "genuinely idle, not staged" instinct as candid_single_take.md
- One clean forward-lean beat is the anchor of the whole clip; everything
  before it is setup, everything after is settling back upright

Lighting:
- Natural/ambient home lighting, nothing studio or flattering-angle
  deliberate — the more "just an ordinary moment" the lighting reads,
  the better

Avoid:
- Any eye contact with the lens, at any point
- Describing the glimpse as static/held/lingering — it must read as a
  fleeting consequence of motion, appearing and resolving within the
  same beat
- Framing the outfit choice itself as the point ("wearing something
  revealing") — the outfit should read as ordinary loose-fit clothing;
  the moment is created by the ANGLE OF HER BODY, not the garment's cut
- Explicit anatomical description — describe fabric/motion, not body
  detail; the reference clip works because it's suggestive-by-implication,
  not explicit
```

## The Load-Bearing Phrase Pattern

The actual mechanism that produces this effect in a Ref2VA prompt is a
specific three-beat description, always in this order:

1. **Setup the garment as loose, not tight** — e.g. "wearing a loose
   crew-neck t-shirt" — a tight/fitted garment can't plausibly gap, so
   this word choice is load-bearing, not decorative.
2. **Tie the shift explicitly to the lean, as physics** — e.g. "as she
   leans forward, the loose neckline of her shirt drifts slightly away
   from her body, giving a brief, natural glimpse consistent with the
   angle of her lean" — the phrase "consistent with the angle of her
   lean" is what keeps this reading as physics rather than a deliberate
   reveal.
3. **Resolve it explicitly** — e.g. "the fabric settles back into place
   as she straightens back up" — without this closing beat, the model
   tends to treat the gap as a held state for the rest of the shot,
   which reads as staged/lingering instead of candid.

Swap the specific activity, garment, and camera angle freely — the three
beats above (loose garment → lean-caused drift, stated as physics → explicit
resolve on straightening) are what to keep constant.

## Common Failure Patterns
- Skipping the resolve beat — the gap should not persist once she's
  upright again.
- Making the glimpse the subject of a full sentence with lingering detail
  — one clause, tied to the motion, is enough; more reads as the model
  overcorrecting into explicit territory.
- Any camera movement/zoom toward the glimpse — the camera must stay
  exactly as fixed and disinterested as it was before the lean; a
  zoom or reframe turns "candid" into "produced."
- Character glancing at camera even once, including after the moment
  resolves.

## Best Suited For
Single-scene, dialogue-free "caught on camera doing something ordinary"
clips built to bait a soft, plausible-deniability visual hook — same
`content_category` as flirty/fan_interaction content, but silent instead
of talking-to-camera.
