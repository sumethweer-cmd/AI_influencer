# Model Spec: {{model_name}}

> Copy this file to `model_specs/{{model_name}}.md` for each ComfyUI
> checkpoint/workflow actually in use. `comfyui-compiler` picks the active
> model_spec whose `scope` matches the item's `delivery_format` — never
> invents syntax that isn't documented here.

```yaml
model_name: "{{e.g. checkpoint/LoRA name}}"
active: false
scope: [{{e.g. image_set, carousel, story}} | {{e.g. video_clip}}]   # which delivery_format values this model handles — more than one model_specs/*.md can be active: true at once, as long as their scopes don't overlap
output_granularity: per_shot   # per_shot | per_content_item — see schemas/compiled_prompt.yaml
comfyui_workflow_ref: "{{path or name of the ComfyUI workflow JSON this targets}}"
```

## Prompt Syntax Rules
{{e.g. does this model use weighted tokens like (word:1.2)? BREAK tokens?
comma-separated tags vs natural language? Any required prefix/suffix?}}

## Known Quirks
{{e.g. "tends to default to direct eye contact unless told 'looking away from camera' explicitly" — feed this back into relevant format_bibles/*.md as it's discovered}}

## Required `params` fields (if any)
{{e.g. steps, cfg, sampler — only list what THIS model actually needs;
comfyui-compiler must not invent fields beyond what's documented here}}

## Video-Specific Notes (if this model supports video/motion)
{{how `motion` in compiled_prompt.yaml should be phrased for this model}}
