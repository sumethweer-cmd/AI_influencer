# Character DNA: {{name}}

> Core Identity — the one-paragraph summary every other file in this folder expands on.

```yaml
name: "{{name}}"
trigger_word: "{{trigger_word}}"        # must be the first token of every positive prompt
core_archetype: "{{one line — e.g. 'playful digital personality'}}"
primary_appeal: "{{one line — e.g. 'cute + teasing + unexpectedly funny'}}"
status: draft   # draft | active
```

## Locked Identity Block (verbatim in every prompt — never paraphrase between shots)

```yaml
description: "{{trigger_word}}, {{one-line physical description}}"
age: "{{age}}"
face:
  preserve_original: true
  makeup: "{{...}}"
hair:
  color: "{{...}}"
  style: "{{...}}"
body:
  frame: "{{...}}"
  # ...add whatever fields this character needs, keep wording identical across shots
distinguishing_marks:
  - "{{...}}"
```

## Negative Prompt Baseline (append to every negative prompt, never omit)

```
{{...}}
```

See also in this folder: `personality.md`, `speaking_style.md`, `humor_style.md`,
`visual_personality.md`, `constraints.md`, `business_goal.md` — content-director
must read all of them before producing a content_spec, not just this file.
