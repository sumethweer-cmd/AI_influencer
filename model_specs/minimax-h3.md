# Model Spec: MiniMax H3

Source: https://github.com/MiniMax-AI/MiniMax-H3/tree/main/.agents/skills/h3-prompt-writing (SKILL.md + references/base-en.txt)

```yaml
model_name: "minimax-h3"
active: true
scope: [video_clip]
output_granularity: per_content_item   # one compiled_prompt.yaml per item, all shots embedded inside via [Shot N] markers — never split across files
comfyui_workflow_ref: "TODO — which ComfyUI workflow JSON wraps this model in this project's setup"
```

> **This is a video+audio generation model, structurally different from a
> classic image-diffusion checkpoint.** One generation call produces a whole
> multi-shot video (visuals + dialogue + ambient sound + music together), not
> a single still frame. `comfyui-compiler` must treat one H3 prompt as one
> content item's full video, not one file per shot — see the open question at
> the bottom of this file.

## Input Modes (pick one per content item)

| Mode | Use when |
|---|---|
| T2VA | No reference image — build the whole video from text alone |
| **Reference mode (default for this project)** | **Picture 1 = Momo's locked identity reference, always.** Uses the `subject_definitions`/`retention_analysis` mechanism below — see decision below. |
| FL2VA / L2VA | Not used by default in this project — revisit only if a specific item needs a locked end-frame |

> **Project decision:** every content item with `delivery_format: video_clip`
> uses reference mode with **Picture 1 always bound to Momo**,
> `retention_analysis: fully_preserved`, AND her full physical description is
> still appended in `subject_definitions` (not relying on the image alone —
> reinforces identity in text too):
> ```
> <Subject 1> is Momo, whose identity comes from <Picture 1>: 20-year-old very
> slender Korean beauty, shoulder-length wavy creamy blonde hair, flawless
> dewy Korean glass skin, glossy lips, soft natural makeup, small perky
> natural B-cup breasts, extremely small defined waist, exceptionally long
> slim elegant legs, small tattoo of a heart and a rainbow on her left upper
> arm, no other tattoos, m0m0. Preserve exactly.
> ```
> Additional reference pictures (Picture 2, 3, ...) for outfits/props/
> background are not standardized yet — handle per-item until a pattern
> emerges from real use.
>
> The actual Picture 1 image file is supplied by the user at generation
> time (handled outside this pipeline) — `comfyui-compiler` just needs to
> reference `<Picture 1>` correctly in the prompt text, it doesn't need to
> produce or locate the image itself.

## Prompt Syntax Rules — Reference Mode (Picture 1 = Momo, project default)

Source: `artfat-comfyui-llm-prompter/prompts/V0_MiniMax_H3_Video.txt` — a
more specific practical template than the base official skill, built exactly
around "one or more reference pictures define reusable subjects." This is
what `comfyui-compiler` should follow whenever the item has a Momo reference image.

**Tags**: `<Picture N>` the image file · `<Subject N>` a reusable element
carried over from a reference (person, object, outfit, location, pose,
style) · `[Shot N]` the scene identifier. One Picture can define several
Subjects.

**Six sections, in order:**
```
subject_definitions:
<Subject 1> is Momo, whose identity comes from <Picture 1>. Preserve her face, hair, tattoo, and body per characters/momo/character_dna.md's Locked Identity Block.
<Subject 2> is [outfit/prop/background, if a second reference picture is used]...

summary:
One bracketed task type (e.g. [Image-to-video]), then one paragraph describing the shot.

retention_analysis:
<Subject 1> (appears in [Shot 1]): fully_preserved — retain identity, hair, tattoo, and body exactly.
<Subject 2> (appears in [Shot 1]): [preservation level] — ...

integrated_multimodal_description:
[Shot 1] Begin exactly from <Picture 1>. Describe what CHANGES over time, in the order it happens — not what's already visible/static in the reference (the model can already see it; re-describing it starves the motion). Name exactly ONE camera instruction per generation (e.g. [Push in], [Static shot]) — never combine several moves.

overall_soundscape:
Diegetic sound only (room tone, movement, contact, environment).

non_diegetic_music:
Score for the audience only, or N/A.
```

**Retention levels**: `fully_preserved` (keep visual detail completely — use
this for Momo's identity, always), `partially_preserved` (only named
elements), `attribute_transfer` (quality/action, not the subject itself),
`weak_reference` (loose guidance only).

**Dialogue**: `<Subject 1> (S1) looks into the camera and physically speaks:
<d>[English] the exact line.</d>` — write the line exactly as it should be
said, short enough to fit the clip duration.

**Limits**: up to 9 images, 3 videos, 3 audio files, 12 files total per generation.

## Prompt Syntax Rules — Base Modes (T2VA, no reference — fallback only)

**Part 1 (I2VA/FL2VA/L2VA only, omit for T2VA):** one alignment-instruction
line, then a blank line, then Part 2. Exact wording per mode:
- I2VA: `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.`
- FL2VA: `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.`
- L2VA: `How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.`

**Part 2 — three core fields, in this order:**
```
integrated_multimodal_description: [Shot 1] ...
overall_soundscape: ...
non_diegetic_music: ...
```

- `integrated_multimodal_description` — the whole visual+action+dialogue
  timeline, all shots embedded as `[Shot N]` markers within this ONE field
  (not separate files per shot). First shot has no timestamp; later shots
  start with a strictly increasing cut time: `[Shot 2] At 00:03.500, ...`.
  State style + composition at the very start of `[Shot 1]` (e.g.
  `Live-action, cinematic, ...`).
- `overall_soundscape` — 1-4 sentences, ambient/physical/non-verbal sound only
  (not dialogue/music). Use `N/A` only if the user explicitly wants total silence.
- `non_diegetic_music` — 1-3 sentences, audience-only background score
  (instrumentation/tempo/dynamics, no mood words). Use `N/A` if none.

## Camera Motion Vocabulary (motion type + amplitude + speed)

Write as a natural-language action within the shot, not stacked labels:
`The camera pushes in with small amplitude at slow speed toward...`

Motion types: `Zoom In/Out`, `Push In/Pull Out`, `Pan Left/Right`, `Truck
Left/Right`, `Tilt Up/Down`, `Pedestal Up/Down`, `Arc Shot`, `Tracking Shot`,
`Static Shot`, `Shake Slightly/Strongly`, `POV`, `Roll Clockwise/Counterclockwise`.
Amplitude (`with small/large amplitude`) and speed (`at slow/fast speed`) —
omit both when medium/normal (the default).

## Dialogue / Speaker Rules

Speaking/singing subjects get a stable ID: `(S1)`, `(S2)`, compound `(S1,S2)`
for simultaneous speech. Same ID across shots for the same speaker; silent
characters get no ID. On first appearance, establish identity via visible +
audible cues (age, gender, pitch, timbre, rate, accent).

```
The young woman with a quiet, breathy voice (S1) says: <d>[English] I get off at the next station.</d>
```
Only the language tag + verbatim user-provided spoken content go inside
`<d>...</d>` — never translate/rewrite it. Voiceover uses the exact phrase
`says in an off-screen voiceover`, immediately followed by a note that the
on-screen character's lips stay closed. Dialogue crossing a cut uses
`<scenetrans>`; speech cut off by video end uses `<cutoff>`.

## On-Screen Text
Visible banners/signs/subtitles go in English double quotes, verbatim,
untranslated: `A red neon sign reading "营业中" glows above the doorway.`

## Required `params` fields
None beyond the structured text fields above — H3's entire spec lives in the
prompt text itself, not a separate params object. `comfyui-compiler` should
leave `compiled_prompt.params` empty for this model.

## Worked Example (T2VA shape, for reference)
See `references/base-en.txt` Case 1-4 in the source repo for full worked
examples per mode (T2VA/I2VA/FL2VA/L2VA) — not duplicated here in full,
fetch from source if a worked example is needed for a specific mode.

---

## RESOLVED (per user decision)
- Video content always uses reference mode with Picture 1 = Momo, `fully_preserved`, identity reinforced in text too (see the block above).
- Additional reference pictures (outfit/prop/background) handled per-item for now, not standardized.
- Actual Picture 1 image file is supplied by the user at generation time — not this pipeline's job to produce it.
- One `compiled_prompt` per content item (not per shot) for this model — see `schemas/compiled_prompt.yaml` (updated).
- Image-generation model confirmed: **Krea** — see `model_specs/krea.md`.
- NSFW default: suggestive/implied (per `characters/momo/constraints.md`). Explicit is allowed ONLY when the human explicitly asks for it on that specific content item — never the pipeline's own default.
