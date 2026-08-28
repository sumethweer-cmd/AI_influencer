# Model Spec: {{model_name}}

> Copy this file to `model_specs/{{model_name}}.md` for each ComfyUI
> checkpoint/workflow actually in use. `comfyui-compiler` reads whichever one
> is marked `active: true` — never invents syntax that isn't documented here.

```yaml
model_name: "{{e.g. checkpoint/LoRA name}}"
active: false   # exactly one model_specs/*.md should be active: true at a time
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
