---
name: storyboard-builder
description: Step 2 of the Reel Machine — turns a reel-intake teardown.md into a scene-by-scene visual storyboard, with an actual reference image generated per scene via the OpenAI or Gemini image API. Each scene lists character(s), setting, script/dialogue, lighting, camera angle/movement, and a clear step-by-step action sequence, for the user to review alongside the teardown before committing to a full content-request generation. Triggers: "build a storyboard", "storyboard this", "turn the teardown into a storyboard", "make storyboard images".
---

# storyboard-builder

Goal: take a `reel-intake` teardown and turn it into a real storyboard — a text breakdown per scene PLUS
an actual generated reference image per scene — so the user can review the plan visually before spending
a real `content-request` generation on it.

## Input → Output
- **Input:** `intake/<slug>/teardown.md` (+ `words.json` if present) from `reel-intake`. Also needs: which
  AI-influencer character this storyboard is being built for (ask if not specified — the character's
  locked identity block has to be slotted into every scene).
- **Output (in `intake/<slug>/storyboard/`):** `storyboard.md` (the scene-by-scene text breakdown) +
  `scene-01.png`, `scene-02.png`, … (one generated reference image per scene).

## Step 0 — local-only, check what's installed
This skill calls a real image-generation API over the network and needs an API key — it must run on a
**local machine**, not this remote sandbox (which blocks outbound calls to `api.openai.com` /
`generativelanguage.googleapis.com` at the network-proxy level — confirmed by direct test, not a guess).
Run `scripts/doctor.sh` first and show the result. Needs: `curl`, `jq`, and one of `OPENAI_API_KEY` or
`GEMINI_API_KEY` set as an environment variable (never pasted into chat or committed to a file — see
Security note below).

## Step 1 — Read the teardown
Read `teardown.md`'s beat table in full, plus `words.json` for pacing if present. Do not skip straight to
writing scenes from memory of the contact sheet — the beat table is the source of truth for what happens
each second.

## Step 2 — Break into scenes
Group the beat table into a manageable number of scenes (usually 4–8 for a 15–30s reel, not one scene per
second) — group contiguous beats that share the same setting/camera setup, the same way
`format-router`/`prompt-enhancer` group beats into shots elsewhere in this pipeline. Each scene must be a
distinct visual moment worth its own storyboard image, not an arbitrary time slice.

## Step 3 — Write each scene, in full detail
For every scene, write ALL of:
- **Character(s)** — who's in frame, referencing the target character's
  `characters/{character}/character_dna.md` locked identity block
- **Setting** — where, matching the teardown's described location/background
- **Script** — the line(s) spoken in this scene, translated/localized from the teardown's transcript
  (never copied verbatim from the source reel — same rule as `reel-intake`)
- **Lighting** — matching the teardown's described look (natural/artificial, hard/soft, color temperature)
- **Camera** — angle, height, framing, movement (static/handheld/push-in/pan), matching the teardown's
  camera notes
- **Action** — a clear, ordered, step-by-step description of physical action in this scene (not a vibe
  description — specific movements in sequence, the same standard `prompt-enhancer` holds video prompts to
  elsewhere in this pipeline)

Write this to `storyboard.md`, one scene per section, numbered to match the image filenames.

## Step 4 — Generate one reference image per scene
For each scene, build a single dense image-generation prompt from its Character/Setting/Lighting/Camera/
Action fields — the Script field is NOT part of the image prompt (it's for the human reader and the later
video-generation step; a still image should not depict spoken lines as on-screen text). Call:
```
scripts/generate-image.sh --provider openai|gemini --prompt "<scene prompt>" --out intake/<slug>/storyboard/scene-NN.png
```
Run scenes one at a time, not in a tight parallel loop — check each result before moving to the next so a
failure on scene 3 doesn't silently waste calls on scenes 4+.

## Step 5 — Hand off
Tell the user `storyboard.md` + the scene images are ready in `intake/<slug>/storyboard/` for review. Once
approved (or after revisions to specific scenes — re-run Step 4 for just that scene), the approved
storyboard becomes the content idea fed into `content-request` for the actual `minimax-h3` compile.

## Security note — API keys
Never ask the user to paste an API key into chat. Set it as an environment variable in their shell
(`export OPENAI_API_KEY=...` / `export GEMINI_API_KEY=...`) before running this skill, or in a local
`.env` file that is `.gitignore`d — never commit a key to the repo.

## Anti-patterns
- Do NOT generate images before Step 3's text storyboard is complete and shown to the user — the text is
  the plan, the image is the visual check, not the other way around.
- Do NOT put the spoken script text into the image-generation prompt as on-screen text/speech bubbles —
  these are silent reference stills, not comics.
- Do NOT skip straight from teardown to images without the per-scene breakdown — the breakdown is what
  makes each image prompt specific instead of generic.
- Do NOT run this skill in the remote sandbox — it needs real network access to the image API, which is
  blocked there.

## Related Skills
- `reel-intake` — produces the `teardown.md` this skill consumes
- `content-request` / `comfyui-compiler` — the next step after the storyboard is approved
