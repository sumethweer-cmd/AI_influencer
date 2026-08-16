---
name: ai-content-pipeline
description: Generates AI influencer content (Content Idea → image/video prompts → post assets) for a named persona defined under personas/*.md in this project, producing ComfyUI-ready prompt files and post-production text assets as separate .txt files. Use this whenever the user asks to create content, prompts, captions, or a content plan for a persona (e.g. m0m0), asks to "สร้าง content", "สร้าง prompt สำหรับ [persona]", wants a Reel/Carousel/Post idea, or references this project's 3-stage pipeline (Content Idea / Raw Material / Production). Trigger even without the word "ComfyUI" — this project's raw-material target is always ComfyUI.
---

# AI Content Pipeline (Nong Kung Agency — Prototype)

This is the prototype replacement for the old DB-driven Gemini auto-planner
(`jobs/weekly-planner.ts` + `ai_personas` table). Instead of an automated
pipeline, Claude generates content directly in conversation using a
persona file as the source of truth, and exports plain files the user can
drop straight into ComfyUI or import into Supabase later.

## The 3 stages this skill covers

1. **Content Idea** — topic, storyline, content_type (Post/Carousel/Story/Reel)
2. **Raw Material** — image prompts + video shot prompts for ComfyUI
3. **Production assets** — caption, on-screen overlay text, V/O script (all separate, never merged)

## Step 0 — Which persona, and confirm the plan before generating anything

Before doing anything else, if the user hasn't already named a persona in
this message, list the personas available under `personas/*.md` (every file
except `TEMPLATE.md`) and ask which one this request is for — don't assume,
and don't silently default to whichever persona was used last in the
conversation.

Once the persona is known, work out the content plan (single item or full
calendar) and **always present it in chat as a summary before generating a
single output file** — for every request, not just weekly-calendar ones.
The summary must cover, per day/item: concept/pillar, outfit, and how many
posts are wanted that day — and if the user hasn't said how many posts/items
they want, ask before drafting the plan rather than assuming a default.
Wait for explicit confirmation (or corrections) before moving on to Steps
1–5. This gate exists so outfit/concept/count mistakes get caught before 7+
files get written per item, not after.

## Weekly Content Calendar mode

When the user asks for a week's worth of content (or just says "plan this
week for {persona}"), don't jump straight to prompts — first brainstorm
**two parallel 7-day calendars: SFW and NSFW**, using the persona's
`sfw_content_pillars`/`sfw_posting_rhythm` and `nsfw_content_pillars`/
`nsfw_posting_rhythm` (in the persona file's Content Niche section). The user
picks per-day which set actually gets used later — generate both by default,
don't ask which one they want unless they explicitly say "SFW only" or
"NSFW only" for this run.

Critical framing: this persona is a **sexy IG model**, not a fitness coach —
never write tutorial/instructional content ("how to squat", explaining form,
rep counts as the point of the post). Every day should read like "here's what
she did/wore today", with the outfit being sexy as the actual point of the
post. Mix pillars across the week the way a real IG model's feed looks: don't
repeat the same pillar back-to-back, per each calendar's `posting_rhythm`.

Default to 1 post/day per calendar (7 SFW + 7 NSFW items) unless the user
asks for a different volume. For each day/set, decide: `content_type`
(Post/Carousel/Story/Reel), `topic`, and which content pillar it draws from.
Show both calendars to the user as two short tables first and confirm before
generating full prompts — generating 14 days' worth of detailed image+video
prompts is a lot of output, so a quick sanity check on the calendar shape
saves rework.

Once confirmed, run Steps 1–5 below for each day/variant, saving into a
per-week folder split by SFW/NSFW:
`content_output/{persona}/{week_start_date}/{sfw|nsfw}/day{N}_{weekday}_...txt`

## Step 1 — Load the persona

Read `personas/{name}.md` for the requested persona (e.g. `personas/m0m0.md`).
If the persona doesn't exist yet, offer to create it from `personas/TEMPLATE.md`
before generating any content — never invent a persona's identity from scratch.

The persona file gives you:
- **Identity block** — locked wording, reuse verbatim across every shot in this content item. Never paraphrase it differently between images in the same set.
- **trigger_word** — must be the first token of every positive prompt.
- **Style/Vibe defaults** — fall back to these when the user doesn't specify lighting/mood/camera.
- **Negative prompt baseline** — append to every negative prompt, never omit.
- **Content boundaries** — respect `nsfw_allowed`/`nsfw_notes`, and the permanent explicit-content limit stated in every persona file regardless of its settings.

## Photography Style — Mandatory for every shot, SFW and NSFW

Every `photography.camera_style` (and the overall `the_vibe.aesthetic`) must
describe an **amateur, unposed photo/video shot handheld on an iPhone 17 Pro
Max** — never "editorial", "professional photography", "fine-art", "studio
glamour", or anything that reads like a styled photoshoot. The whole point is
that it looks like something a real person took of themselves, not content a
photographer produced. This applies equally to NSFW shots — NSFW content
should read as a sexy amateur selfie or candid amateur shot (mirror selfie,
held-out phone angle), not a staged glamour shoot, even when the persona's
NSFW pillars mention "glamour" as a mood word.

Concrete markers of amateur-feeling shots to reach for: slightly imperfect
phone-camera framing, natural handheld angle (not a perfectly composed
tripod shot unless the concept specifically calls for one, e.g. a vlog
tripod setup), whatever light is actually in the scene rather than styled
studio lighting, phone visible in frame for selfies. Avoid photography
vocabulary associated with professional shoots (three-point lighting,
softbox, backlit rim glow as a *styling choice*, fine-art composition terms)
unless the user explicitly asks for a professional-look shot for a specific
item.

## Step 2 — Decide shot count together with the user

There is no fixed default. For each content item, decide `shot_count` (image
prompts and/or video shots, typically 3–6) based on what the content actually
needs — a simple Post needs 1 image, a Carousel needs 4–5, a Reel needs a
handful of video shots that cut together into one scene. Ask the user if the
content type/mood makes shot count ambiguous.

## Step 3 — Generate prompts, always producing image AND video prompts

Regardless of the final `content_type`, generate **both** image prompts and
video-shot prompts for every content item — the user decides later whether to
render stills only or animate them too, so don't skip video prompts just
because the idea started as a Carousel.

Within one content item, keep the character/outfit/background/vibe description
**consistent word-for-word across shots** — only vary what's actually different
per shot (pose, expression, camera angle, specific motion for video). This
mirrors the persona's Identity-block rule but applies it to the shot-varying
parts (outfit, setting) too, for the duration of one content item.

## Step 4 — Production assets (always 3 separate outputs, never merged)

For every content item produce:
- `caption` — the actual post caption (IG/X copy, hooks, hashtags as needed)
- `overlay_text` — the on-screen burned-in text (TikTok/Reel style bold hook text), short and punchy, distinct from the caption
- `vo_script` — a full narration script meant for a separate TTS pass, written to be *spoken*, not posted

These three must never collapse into one field — even if the content is a
simple Post with no video, still ask whether a vo_script is needed or leave
it explicitly empty rather than reusing the caption text.

## Step 5 — Export as separate self-contained .txt files

Every prompt/asset is its own file, fully self-contained (a full positive
prompt already includes the persona's identity + trigger word — no merging
needed downstream).

- **Single content item (no calendar):** save to `content_output/{persona}/{date}/`
  ```
  {persona}_{date}_item{NN}_image_shot{N}.txt
  {persona}_{date}_item{NN}_video_shot{N}.txt
  {persona}_{date}_item{NN}_caption.txt
  {persona}_{date}_item{NN}_overlay_text.txt
  {persona}_{date}_item{NN}_vo_script.txt
  ```
- **Weekly calendar mode:** save to `content_output/{persona}/{week_start_date}/{sfw|nsfw}/`, one subfolder per day
  ```
  content_output/{persona}/{week_start_date}/sfw/day1_{weekday}/{persona}_item01_image_shot1.txt
  content_output/{persona}/{week_start_date}/sfw/day1_{weekday}/{persona}_item01_caption.txt
  content_output/{persona}/{week_start_date}/nsfw/day1_{weekday}/{persona}_item01_image_shot1.txt
  content_output/{persona}/{week_start_date}/nsfw/day1_{weekday}/{persona}_item01_caption.txt
  ...
  ```

Each `image_shot{N}.txt` / `video_shot{N}.txt` file contains a **fully
detailed, self-contained JSON object** describing that single shot — not a
flat prose paragraph. Every field the character/outfit/scene needs goes in
as its own nested key, mirroring this structure (adapt keys as the shot
needs, this is the shape, not a rigid schema):

```json
{
  "subject": {
    "description": "trigger_word, full one-line summary of who she is and what's happening in this shot",
    "age": "...",
    "expression": { "eyes": "...", "mouth": "...", "overall": "..." },
    "face": { "preserve_original": true, "makeup": "..." },
    "hair": { "color": "...", "style": "...", "effect": "..." },
    "body": { "frame": "...", "waist": "...", "chest": "...", "legs": "...", "skin": { "tone": "...", "texture": "..." } },
    "pose": { "position": "...", "base": "...", "overall": "..." },
    "clothing": { "type": "...", "color": "...", "details": "...", "effect": "..." },
    "footwear": { "type": "...", "color": "...", "details": "..." }
  },
  "accessories": { "prop": "..." },
  "photography": {
    "camera_style": "...",
    "angle": "...",
    "shot_type": "...",
    "texture": "...",
    "lighting": "...",
    "depth_of_field": "..."
  },
  "background": { "setting": "...", "elements": ["..."], "atmosphere": "...", "lighting": "..." },
  "the_vibe": { "energy": "...", "mood": "...", "aesthetic": "...", "story": "..." },
  "constraints": {
    "must_keep": ["trigger_word", "hair color/style", "body descriptors", "outfit specifics", "..."],
    "avoid": ["...", "..."]
  },
  "negative_prompt": ["...", "..."]
}
```

Every field's value is written out in full, natural-language detail (like
the `must_keep`/`avoid`/`negative_prompt` arrays in the persona's baseline) —
this is deliberately verbose per file since Option B (separate files) trades
duplication for each file being usable on its own. Don't include an
`aspect_ratio` field or any resolution/ratio setting anywhere — the user
configures that themselves in ComfyUI.

`video_shot{N}.txt` uses the same shape, plus a `motion` object describing
how the pose/camera/fabric changes over the clip's duration (what starts the
shot, what happens, how it ends).

This is a prototype-phase convention — later, once this proves out, these
files get read by an import script into the `content_items`/`generated_images`
tables instead of manual drag-and-drop into ComfyUI. Don't build that importer
until asked; for now the .txt files ARE the deliverable.

## Notes

- This skill does not touch Supabase, Runpod, or the existing Phase 2/3
  automation (`jobs/production-runner.ts`, `jobs/qc-manager.ts`) — those still
  run on the old pipeline for now. This skill only replaces Phase 1 content
  generation for personas being prototyped this way.
- If asked to add a new persona, use `personas/TEMPLATE.md` as the starting
  point and fill in every `{{...}}` placeholder — don't leave any unresolved.
