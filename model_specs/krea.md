# Model Spec: Krea

Source: `artfat-comfyui-llm-prompter/prompts/` — `0_Prompt_Enhancer.txt` and
the smartphone-style templates (`B0_Smartphone_Default.txt` etc.). These are
LLM-facing prompt-engineer instructions, not fixed templates — `content-director`/
`comfyui-compiler` should follow their rules to write a fresh prompt per item,
not copy-paste the example text.

```yaml
model_name: "krea"
active: true
scope: [image_set, carousel, story]
output_granularity: per_shot   # one compiled_prompt.yaml per shot/slide
comfyui_workflow_ref: "TODO — which ComfyUI workflow JSON wraps Krea in this project's setup"
```

## Prompt Syntax Rules

**Output shape: ONE continuous flowing English prose paragraph — not
comma-separated tags.** ~75-100 words (150-200 if explicitly asked for more
detail), never exceeding 512 tokens. No line breaks, no labels/headers, no
commentary — output only the final prompt text. This is a real difference
from typical weighted-tag SD prompts; do not fall back to tag style unless
the user explicitly asks for tags.

**Priority order when writing the paragraph** (highest wins on conflict):
1. Explicit instruction for this specific item (from `content_spec`/`enhanced_spec`)
2. The base input/scene being described (from `enhanced_spec.scene_description`)
3. Style defaults below

**Momo's trigger word** (`m0m0`, from `character_dna.md`) — use naturally
within the prose, not as a bolted-on tag at the start (this model reads
natural sentences, not a tag list).

## Style Default — Smartphone / Amateur

Matches Momo's `visual_personality.md` "amateur, unposed, real-person-shot-this"
default. Weave several of these markers naturally into the paragraph, not all
of them every time:
- Camera: "shot on iPhone 15 Pro" / "26mm main camera f/1.78", "computational
  HDR", "slight sensor grain / chromatic aberration", "vertical 9:16 phone
  framing", "computational night mode" if the scene is dim.
- Light: available indoor/outdoor or window light, warm tungsten or overhead
  room light, uneven natural exposure.
- Subject/mood: candid unposed expression, natural smile or slightly tired
  eyes, spontaneous real-life moment, slight motion blur, real-life clutter
  in the background — never "editorial/professional/studio" language, per
  `character_dna.md`'s negative baseline.

## Content / NSFW Handling

**Default: describe exactly what `enhanced_spec` calls for — suggestive/
implied only** (per `characters/momo/constraints.md`'s `nsfw_notes`). **Do
not escalate to explicit on your own.** If a specific content item's human
instruction explicitly asks for nude/explicit content for that item, follow
it plainly (precise, non-euphemistic description) for that item only — this
is a per-item override, never a standing default. The permanent hard limits
in `constraints.md` (no minors, no non-consensual, no hardcore/explicit
beyond what's explicitly requested) always apply regardless.

## Known Quirks
TODO — log here as discovered from real generations (e.g. "tends to do X
unless told Y explicitly").

## Required `params` fields
None documented yet — this model's spec lives entirely in the prose prompt.
Leave `compiled_prompt.params` empty unless a real requirement is found.

## Reference Library (not yet imported)

The source repo has ~40 scenario-specific variants of this template
(`B1`-`B34`, e.g. `B16_Smartphone_TikTokRingLight`, `B19_Smartphone_GymMirror`)
plus alternate aesthetics (`A_Magazine_Cinematic`, `C_Vintage_Film`,
`H3_Polaroid_Instax`, etc.). Per the user's direction, these are reviewed and
imported selectively into `format_bibles/` as standout ones are picked — not
a bulk import. Not done yet; revisit when picking specific scenarios.
