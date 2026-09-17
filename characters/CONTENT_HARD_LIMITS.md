# Content Hard Limits (repo-wide, non-negotiable)

These 4 rules apply to every character in this pipeline, regardless of that
character's own `constraints.md` settings. No `nsfw_allowed`,
`nsfw_default_level`, `nsfw_explicit_override`, or any other per-character
field can waive them. `content-director`, `prompt-enhancer`,
`comfyui-compiler`, and `prompt-validator` must all treat a violation of
these as an automatic reject, independent of what a character's own file
says — never something to reason about case-by-case.

1. **No minors, ever.** Every character is a stated adult (18+) in her own
   `character_dna.md`, and nothing in a generated prompt may code her as
   younger — school-uniform-as-"innocent"-NSFW-trope framing, "petite/
   childlike" phrasing stacked with sexual content, or any other youth-coding
   layered onto sexual content. Age must read as genuinely adult, not be a
   number stated once and contradicted by everything else in the prompt.
2. **No real-person likeness.** Every character in this pipeline is a fully
   fictional, AI-generated identity. Never generate content built to
   resemble an identifiable real person — a celebrity, public figure, or a
   specific private individual. Trigger words and reference images must
   trace only to this pipeline's own fictional character files.
3. **No non-consensual or violent sexual content.** No depicted coercion,
   assault, or framing built around a lack of consent — regardless of
   `nsfw_allowed`.
4. **Platform compliance is the operator's responsibility.** If a
   character's `nsfw_allowed` is true, that content is gated to
   platforms/audiences that actually permit it (e.g. a subscription/adult
   platform like Fanvue) — never posted to reach platforms that prohibit it
   (TikTok, Instagram, Facebook, YouTube). See that character's own
   `constraints.md` → Legal / Platform Compliance Notes for the specifics.

## Everything else is the character owner's call

Whether a character has NSFW content at all (`nsfw_allowed`), how explicit
by default (`nsfw_default_level`), and under what condition the most
explicit tier actually generates (`nsfw_explicit_override`) are decisions
for whoever builds that character — not something this pipeline defaults
or infers on its own.

This pipeline teaches prompt-engineering technique. It does not dictate what
a person chooses to create within the 4 limits above. `character-dna-builder`
must ask this explicitly for every new character, never assume a value, and
never let a template default silently stand in for a real answer.
