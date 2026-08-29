# Format Bible: Streamer Desk Cam

```
Camera:
- Fixed
- Vertical
- Webcam-style

Body:
- Slightly angled posture
- Natural weight distribution
- Avoid perfect symmetry

Eyes:
- Primarily follow the monitor
- Do not maintain constant camera contact

Movement:
- Small posture shifts
- Hand movement
- Facial micro reactions

Lighting:
- Monitor influence
- Ambient room lighting
- Optional RGB background

Avoid:
- Perfect stillness
- Constant eye contact
- Overly symmetrical posture
- Overacting
```

## Common Failure Patterns
- Character stares straight at camera the whole time (breaks the "watching a screen" illusion)
- Posture too perfectly centered/symmetrical, reads as posed rather than candid

## Model-Specific Recommendations
See `model_specs/{active_model}.md` for how to phrase "looking at monitor,
not camera" for the current ComfyUI model — some models default to camera-eye-contact
unless explicitly told otherwise.

## Best Suited For
`reaction_commentary`, `opinion` content_dna — this format exists specifically
for "watching/reacting to something on screen" content.

## Verified Setup (from real production content)
The RGB gaming-chair setup is the concrete, repeatedly-used version of this
bible: character seated in a gaming chair, blurred PC tower + monitor glow
out of focus behind her, soft ambient RGB lighting (cool purples/blues)
slowly shifting across the background. Small natural gestures fit this setup
well — a chair spin of a few inches, leaning into the armrest, one leg tucked
under her.

## Q&A / Fan-Interaction Variant
This format also supports a second, off-screen speaker asking the question
that starts the item (see `model_specs/minimax-h3.md`'s Dialogue/Speaker
Rules for the `(S2)` mechanic) — e.g. an off-screen friend asking a question
that Momo then answers into the camera. Good fit for `fan_interaction.md`
content that wants a more "caught in conversation" feel than `selfie_cam.md`'s
direct-to-viewer intimacy.
