# Content DNA: Lookbook / Editorial Shoot (silent)

A magazine-style shoot of the character, made of shots only. No speech, no crew, no
text on screen: mood, light, concept and set carry the piece. Reads like a fashion
lookbook, a swimwear / lingerie campaign, or a candid "behind the frame" moment
captured by a photographer who never appears.

## Structure
```
Opening frame (set + light establish the concept)
Pose / movement beat 1   (full or three-quarter body, the outfit reads clearly)
Detail beat              (fabric, skin-light, hands, hair, accessory — body kept tasteful)
Pose / movement beat 2   (change of angle or position, same concept)
Closing frame            (held look, a turn away, or a soft glance to lens — then hard cut)
```
Each 8 s segment = 3-4 shots (about 2-2.5 s each). A clip is 1-3 segments.

## When content-director should pick this
- The goal is glamour / reach / membership funnel, not a joke or an opinion
- Outfit-led themes: new lingerie set, swimwear / bikini try-on look, resort / boudoir /
  loungewear, evening dress, sheer layers, robe, knitwear on bare skin (implied)
- "Candid mode": a caught-in-the-moment feel (adjusting a strap, turning on a bed,
  stepping out of a pool) as if photographed, not performed
- Never when dialogue or a punchline is needed — use `flirty.md` or `comedy.md`

## What does the work (instead of speech)
1. **Concept** — one sentence that sets the mood ("hotel room at golden hour, linen
   curtains moving", "pool at dusk, wet stone, warm lanterns")
2. **Set** — real, specific, tactile surfaces; styled to match the outfit colour story
3. **Light** — motivated and named: window light, golden hour, rim light from a lamp,
   neon glow, soft overcast. Skin kept natural (no plastic glow)
4. **Shots** — change shot size and angle every beat (see the format bible
   `format_bibles/editorial_lookbook.md`); simple, renderable camera moves only
5. **Body language** — slow, confident, unposed-looking: weight shifts, a hand running
   through hair, a strap adjusted, a look held a half-second too long

## Rules
- Fully silent: no `<d>` lines, no speech, no lip movement suggesting speech
- No on-screen text, captions, logos, brand names; no other people, no photographer,
  no camera or lighting gear visible in frame
- Suggestive / implied only, per `characters/<name>/constraints.md` (Momo: swimwear,
  lingerie as fashion, sensual glamour; covered; no explicit nudity)
- Adult character only; styling and set must read as an adult editorial
- Outfit written item by item (cut, neckline, fabric, colour, how it sits), because
  the outfit is the product of the shoot

## Output requirement: scene reference suggestion
Because the set is half of the piece, every item written for this type must carry a
**scene suggestion** the owner can use to find or generate a background reference
image (it is shown next to the picture slots on the Content page):
```
sceneHint: "<one or two sentences: place, key surfaces/props, time of day, light direction and colour>"
```
Example: "Minimal hotel suite, white linen bed, tall sheer curtains, late-afternoon sun
from the left, warm beige palette; no people, no text."
If a scene reference image is attached as <Picture 2>, describe the room as shown in
that picture instead and keep the hint for the next version.

## Notes for character_take
There is no `character_take` speech. Express personality through pace and gaze:
Momo is confident and playful — a slow smile, a teasing sideways look, never
desperate or over-posed (see `characters/momo/personality.md`).
