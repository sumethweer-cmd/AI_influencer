# Format Bible: POV First-Person

Source: adapted from an external smartphone-aesthetic prompt library
(camera/scene mechanics rewritten in this project's own schema and voice —
no text copied verbatim; NSFW-permission and output-length rules from the
source were dropped, since `constraints.md` and `model_specs/*.md` already
own those decisions in this pipeline).

**Not the same format as `pov_comedy.md`.** `pov_comedy.md` treats the
camera as *another character* she performs toward (eye contact with the
lens = eye contact with that implied person) — built for a joke structure.
This format is a literal first-person viewpoint: the camera **is** her own
eyes. What's in frame is only what she herself would see, looking wherever
she's looking. There is no "other person" the camera represents.

```
Camera:
- True first-person point of view — the shot shows what SHE sees, not a
  shot OF her. Work out where she's looking first (down at her own body,
  ahead at something/someone, across a room), then describe only what's
  in that direction.
- Her own face, head, and full body are never in frame — the camera is
  positioned at her eyes, looking outward, not at her from outside. If a
  generated shot shows her full face looking into the lens, that's a
  `selfie_cam.md`/third-person shot, not this format.
- Natural handheld sway, phone main-camera image quality, no camera
  movement beyond what her own head/body movement would produce.

The hands rule (this is the detail that makes or breaks this format):
- One of HER hands is holding the phone taking this shot — that hand is
  occupied and sits behind the camera, so it never appears in frame.
- At most ONE of her own hands (the free one) may appear on screen. Name
  only that hand and what it's doing — never describe or account for the
  phone-holding hand in the prompt at all.
- Never describe the camera-phone itself as an object in the scene, and
  never describe the act of "taking a selfie/filming herself" — the moment
  either gets written, the model tends to render a phone edge and a stray
  extra finger. The phone exists only as an image-quality phrase (e.g.
  "phone main-camera quality"), never as a visible object.
- A DIFFERENT phone that's genuinely part of the scene (on a nightstand,
  in someone else's hand) can be described normally — this rule is only
  about her own camera-phone/holding hand.

When looking down at her own body:
- The camera sits at her own eye position looking down the length of her
  body. The highest visible point is the lower curve of what's directly
  below her chin/collarbone-line — never her own upper chest, shoulders,
  neck, chin, or face. From there the frame recedes down her body toward
  the far edge (foreshortened, shrinking with distance).
- Her single free hand may rest on her body or reach into the scene; the
  other hand stays off-frame (busy with the phone).

When looking ahead at a person/scene:
- That person or scene fills the frame naturally — another person in the
  scene CAN look back into the lens (they're not under this format's
  restrictions, only she is). Only her single free hand may enter an edge
  of frame.

Avoid:
- Any view of her own face, a full third-person body shot of her, or a
  mirror reflection showing her face — all three break the "these are
  literally her eyes" premise
- Showing both of her own hands — one is always occupied holding the phone
- Describing the phone or the act of filming as visible content
```

## Best Suited For
An intimate, immersive beat within a longer piece — a single shot that
puts the viewer directly in her point of view, rather than watching her.
Works well as one shot inside a multi-shot sequence rather than an entire
piece, since the format inherently withholds her face for its duration.
