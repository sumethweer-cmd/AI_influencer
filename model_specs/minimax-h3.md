# Model Spec: MiniMax H3

Source of truth: **3 real production prompts** the team already generated
with this model (Momo — "BoyfriendFromAnotherNation", "ParachuteBusiness",
"CabinCrewOutfit"), not the external repos referenced earlier this session —
those got two structural details wrong, corrected below.

```yaml
model_name: "minimax-h3"
active: true
scope: [video_clip]
output_granularity: per_content_item   # one compiled_prompt per item, all shots embedded inside via [Shot N] markers — never split across files
default_mode: "Ref2VA (full-reference)"
comfyui_workflow_ref: "TODO — which ComfyUI workflow JSON wraps this model in this project's setup"
```

> **This is a video+audio generation model, structurally different from a
> classic image-diffusion checkpoint.** One generation call produces a whole
> multi-shot video (visuals + dialogue + ambient sound + music together).

## Mode: Ref2VA (full-reference) — the project default

Every real example uses **Ref2VA**, not the simpler I2VA-style "reference
mode" documented here earlier. Momo's identity picture, her outfit picture,
and the background/setting picture are all supplied as separate labeled
references in one call.

**Two corrections from what was documented before:**
1. The description field is called **`detailed_description`**, not
   `integrated_multimodal_description`.
2. **`<Picture N>` is referenced directly** in prose — there is no
   `<Subject N>` abstraction layer. Write `Momo <Picture 1>, wearing
   <Picture 2>, sits in her gaming chair <Picture 3>...`, naming her by name
   inline with the picture tag, not `<Subject 1> (S1)...`.

## Six sections, in order (verified shape)

```
subject_definitions:
<Picture 1> [Character] - [full locked identity description, verbatim from character_dna.md] - [what this picture defines, e.g. "the woman seated in the gaming chair who answers the off-screen question and speaks directly into the camera"].
<Picture 2> [Character]'s outfit, worn continuously throughout the scene.
<Picture 3> is [the setting/background] - visible as the background throughout the scene.

summary:
[reference generation] or [keyframe completion] — one paragraph describing what happens across the whole clip, naming what each Picture defines.

retention_analysis:
<Picture 1> (appears in [Shot 1], [Shot 2], ...): fully_preserved - identity, facial features, and expressions retained exactly across all shots.
<Picture 2> (appears in [Shot 1], ...): fully_preserved - the outfit retained unchanged across all shots.
<Picture 3> (appears in [Shot 1], ...): fully_preserved - the setting retained as the background throughout.

detailed_description:
One overall-style/setting sentence, then [Shot 1] ... [Shot 2] At MM:SS.mmm, ... — see Shot/Timing rules below.

overall_soundscape:
Diegetic sound only — room tone, ambient hum, fabric rustle, audible reactions (e.g. a genuine laugh).

non_diegetic_music:
Score for the audience only, or N/A.
```

**`summary` line tags**: `[reference generation]` for a fresh scene built from
the references, `[keyframe completion]` when one Picture is literally the
opening frame the video completes from (e.g. she's already posed in the
reference image and the video starts exactly there).

**Retention levels**: `fully_preserved` (use for identity/outfit/setting —
all three verified examples use this for every Picture, every shot),
`partially_preserved`, `attribute_transfer`, `weak_reference` — available if
a future item needs looser preservation, but default to `fully_preserved`
for anything identity-critical.

## Shot / Timing Rules (verified — H3 supports precise timestamps)

- First shot has no timestamp. Every later shot starts with `At MM:SS.mmm,
  the camera cuts to...` — always increasing, always this decimal format
  (`00:04.600`, `00:06.150`, `00:10.700`).
- **Every pause/beat gets an explicit numeric duration, not a vague "a
  pause."** Verified phrasing: `holding a clear beat of about 0.8 seconds`,
  `holding a full 1.1-second silence`, `a shorter beat of about 0.6 seconds`.
  This is a hard requirement, not a nice-to-have — `prompt-enhancer` must
  write real numbers here, and `prompt-validator`'s naturalism check should
  flag a beat/pause with no duration attached.
- A cut should land on a real structural beat (new expression, new info, a
  punchline) — matches the general "camera motion" vocabulary documented
  below, just applied with real timestamps instead of vague cut cues.
- **When the visual_format calls for locked/fixed framing across shots
  (e.g. `pov_qa_reaction.md`, `silent_reaction_beats.md`, `pov_comedy.md` —
  "one cut per beat" with NO camera movement), say so explicitly and
  negatively, not just descriptively.** Writing "the camera cuts to the same
  fixed close-up framing" at every shot boundary is a weak signal — restating
  a description of the framing reads to the model as *setting up* a shot, so
  repeating it at each cut can itself introduce drift (a slight zoom,
  re-angle, or reframe) even though the intent is a single locked framing
  broken only by hard edit points. Instead, state the negative directly:
  `the camera cuts on the beat — same distance, same angle, same framing as
  the previous shot, no zoom or reframe` (or equivalent explicit "unchanged
  from previous shot" phrasing). Confirmed failure mode (2026-09-05): a
  pov_qa_reaction item generated visible zoom/refocus drift between its 3
  shots despite each one saying "cuts to the same fixed close-up framing."

## Dialogue / Speaker Rules

Same `(S1)`/`(S2)` mechanic as documented before, but **verified in real use
for two-person exchanges**: an off-screen second speaker is a normal,
supported pattern for Q&A / fan-interaction content —
```
An off-screen friend's voice (S2), warm and casual, asks from just beside the camera, <d>[English] Do you have a boyfriend?</d>
Momo (S1) answers almost immediately at a relaxed, confident pace, <d>[English] Yeah.</d>
```
`(S2)` never needs a Picture reference if they stay off-screen the whole clip.
Delivery pace is part of the line, not just the words — `at a relaxed,
confident pace`, `at a plain, matter-of-fact pace`, `at a proud, satisfied
pace` are all doing real work; don't drop pacing description to save words.

## Naturalism — the actual bar, not a vague "make it natural"

This is the single biggest gap in what was documented before. Verified
examples never write a generic "she smiles" or "she laughs" — every reaction
has a specific, physical, slightly-imperfect tell:
- `one hand rising to cover her mouth, nose scrunching, shoulders bouncing softly`
- `glancing off to the side toward her monitor as if deciding how much to reveal, absent-mindedly spinning her chair a few inches`
- `she can't hold it anymore, breaking into a light, genuine giggle`
- `one eyebrow very slightly raised as if daring the viewer to guess what's coming`

Straight-faced setup before a punchline is a deliberate, named technique in
these examples (`holding a full 1.1-second silence with direct eye contact
and a completely deadpan expression`) — the stillness before the reveal is
what sells the timing; don't confuse this with the "avoid complete stillness"
rule elsewhere, which is about the absence of ANY natural micro-movement
across a whole shot, not a deliberate held beat before a punchline.

Real production files literally track this as a revision note — treat
"reduce stiff, posed AI look" as an explicit, recurring self-check for
`prompt-enhancer`, not just a background goal.

## Duration Limit — Split Above ~15 Seconds (per-item generation constraint, 2026-09-05)

A single H3 generation call reliably degrades past roughly 15 seconds — long
items must be split into multiple separate compiled prompts (each its own
generation call), not one long prompt. This is a **generation-length limit**,
distinct from the earlier "shot duration must match speech pace" rule (that
one is about internal timing accuracy; this one is about total call length).

- Estimate total runtime the same way as before (word count at ~2.5-3
  words/sec + all pause durations). If the total exceeds ~15 seconds, split
  the shot sequence into 2+ segments at a natural shot boundary — **never
  mid-line, mid-sentence, or mid-pause**.
- Each segment must be a **complete, self-contained H3 prompt** with all six
  sections (`subject_definitions` through `non_diegetic_music`) — not a
  fragment. Copy the full locked identity block, outfit, and setting into
  every segment; a later segment doesn't inherit anything from an earlier
  one at generation time, since each is a separate call.
- **Continuity across segments is your job to write in, not something the
  model infers**: segment 2's opening line/shot must describe her current
  state as a continuation of exactly where segment 1 left off (same
  expression/posture/emotional beat she ended on, described fresh at the
  start of segment 2's own `detailed_description`) so the two clips read as
  one continuous scene when joined, not two disconnected takes.
- In `comfyui-compiler`'s output: write each segment as its own complete
  `compiled_prompt`, and push each as its own `pipeline_content_items` row
  per `content-request/SKILL.md` Step 3's segment-push convention (segment 1
  first, then later segments referencing its row id via
  `parent_content_item_id` + their own `segment_number`).

## Camera/Lighting Realism (required — avoid the "AI slop" look)

Confirmed failure (2026-09-05, human review after testing generated clips):
lighting was never specified, and the result "looks very AI, very AI slop" —
too clean/glossy, reading as an obviously synthetic render rather than
real footage. **Every compiled prompt must explicitly state a natural,
imperfect camera/lighting quality** unless the item specifically calls for
something more polished (e.g. a deliberately editorial/studio piece, which
should be rare per `visual_personality.md`'s "not studio/editorial" default):
- Natural/ambient light, not studio-lit — window light, overhead room light,
  outdoor daylight, whatever the actual setting would really have.
- Handheld phone-camera quality/aesthetic — the implied "camera" in most of
  these formats (selfie_cam, POV formats, candid_single_take) *is* a phone,
  so say so: phrase like `natural handheld phone-camera quality, slight
  natural imperfection, not overly polished/glossy`.
- This is a default requirement to add explicitly to every compiled prompt's
  scene-setting language (subject_definitions' Picture 3 / detailed_description's
  opening line), not something to assume the model infers on its own.

## Shot Duration Must Match Actual Speech Pace (do not assert a timestamp that doesn't fit the words)

Confirmed failure (2026-09-05): items where the declared shot duration
didn't actually match how long the dialogue takes to say at natural pace
caused visible visual flip-flopping/drift between cuts — the model has to
"catch up," which reads as the image changing back and forth rather than a
clean cut. Before finalizing shot timestamps:
- Compute actual speech duration from word count (Thai: ~2.5-3 words/sec)
  and add the described pause durations — the shot's total declared length
  must equal (or very slightly exceed) that sum, never assert a shorter
  window than the dialogue+pauses actually need.
- If a shot's dialogue+pauses don't fit its assigned timeframe, the fix is
  to shorten the dialogue or lengthen the timestamp — never leave a
  mismatch and hope the model compresses the delivery to fit, since that's
  exactly what produces the visual instability described above.

## On-Screen Text
Visible banners/signs/subtitles go in English double quotes, verbatim,
untranslated: `A red neon sign reading "营业中" glows above the doorway.`

## Required `params` fields
None — H3's entire spec lives in the six structured fields above. Leave
`compiled_prompt.params` empty for this model.

## Output File Header Convention (adopt this — genuinely useful, seen in every real example)

Every real `compiled_prompt` file opens with a short metadata header before
the six sections — `comfyui-compiler` should write one too:
```
# CONTENT — <short title>
# Date: <date>
# Character: <name> | Mode: Ref2VA (full-reference)
# Setting per request: <setting, if it's a recurring one worth naming>
# Assumption: <anything inferred rather than stated, e.g. "outfit = <Picture 2> reused from prior content">
# Pillar: <content_dna category / pillar this belongs to>
```

---

## RESOLVED (verified against real production files — this session's earlier assumptions corrected)
- Mode is **Ref2VA**, field name is **`detailed_description`**, Picture tags used directly (no Subject layer) — corrects the earlier "reference mode" write-up.
- Beats/pauses need explicit numeric durations; reactions need specific physical micro-tells — corrects the earlier vague "natural micro-movement" guidance.
- Off-screen second speaker `(S2)` is a supported, normal pattern for Q&A content.
- Output files should carry the metadata header shown above.
- One `compiled_prompt` per content item (not per shot) for this model — see `schemas/compiled_prompt.yaml`.
- Image-generation model confirmed: **Krea** — see `model_specs/krea.md`.
- NSFW default: suggestive/implied (per each character's `constraints.md`). Explicit is allowed ONLY when the human explicitly asks for it on that specific content item.
