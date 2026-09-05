---
name: content-director
description: Internal pipeline layer — analyzes a content idea against a character's DNA and produces a content_spec (category, mechanic, and an actual in-character line). Invoked by content-request, not directly by a human.
---

# Content Director

Answers: *what content are we making, and why* — and critically, *what does
the character actually say/do about it*.

## Step 0 (mandatory, do not skip) — Load DNA before reasoning

Read, in full, before writing anything:
1. `characters/{character}/character_dna.md`
2. `characters/{character}/personality.md`
3. `characters/{character}/speaking_style.md`
4. `characters/{character}/humor_style.md`
5. `characters/{character}/constraints.md`
6. `characters/{character}/business_goal.md`

Do not rely on these files from earlier in the conversation — re-read them for
every invocation. Character DNA drifting because it was half-remembered is the
main failure mode this step exists to prevent.

## Step 1 — Pick content_category

Must be one of the existing files under `content_dna/` (read the list, don't
invent a category). If the idea doesn't clearly fit one, pick the closest and
note why in `core_mechanic` — don't leave `content_category` as free text that
has no matching file, `delivery-format-selector` and downstream layers depend
on the file existing.

## Step 1.5 — Source a real joke/premise before inventing one (do not skip)

AI-invented jokes/premises reliably read flat — this project has confirmed
that the hard way. Before writing an original comedic premise from scratch,
search for one that already exists and works, then translate/localize it:

- Use WebSearch for the topic/mechanic in play — English-language sources are
  completely fine (jokes, one-liners, prank formats, classic skit premises,
  reddit/twitter jokes, stand-up bits) — translate to Thai and adapt as part
  of this step. Example already in this project: the "โทรศัพท์เครื่องนี้ของ
  ใครคะ?" candid clip is a Thai adaptation of the English "whose phone is
  this" prank-call joke format, not an original premise.
- **Source situational/premise humor, not wordplay.** This is the difference
  between a joke that survives translation and one that doesn't. A premise
  joke's comedic mechanism lives in the *story* — misdirection, escalation,
  mistaken assumption, absurd juxtaposition, a prank format — and that
  structure works in any language, which is exactly why "โทรศัพท์เครื่องนี้ของ
  ใครคะ?" (whose phone is this) translates cleanly from an English prank-call
  format: the humor is "casually spending someone else's money, then
  realizing it's not even her phone," not a play on any specific word.
  A wordplay joke's mechanism lives in a specific language's double meaning
  or homophone (e.g. English "WiFi... feeling the connection") — that breaks
  the instant you translate it, because Thai doesn't share the same
  coincidence. Reject any source joke whose humor depends on a pun,
  homophone, or wordplay that only works in the source language.
  Also reject any source joke whose premise depends on a foreign cultural
  convention that isn't actually a shared reference point in Thai culture
  (e.g. Western "what's your zodiac sign" as dating small talk) — even a
  perfect translation won't land if the audience doesn't recognize the setup.
  **Quick test**: could this exact joke be told in a third, unrelated
  language and still land the same way, purely from the situation? If yes,
  it's premise-based and safe to adapt. If it only works because of a
  specific word or a specific culture's convention, find a different source
  joke instead of forcing a translation.
- Adapt, don't transplant verbatim: swap any culturally-specific references
  for ones that land in Thai, and refit the premise's timing/beats to
  whichever `format_bibles/{visual_format}.md` structure this item will use.
  It still has to pass through the same personality/humor_style filter as
  Step 2 below — an existing joke that violates `humor_style.md`'s Things to
  Avoid list needs a different existing joke, not a pass-through.
- Record what you adapted in `source_reference` (one line — the joke
  format/premise and where the idea traces back to, not a citation). Leave
  `source_reference: null` only if a genuine search turned up nothing
  fitting and you had to originate the premise yourself — that should be the
  exception, not the default.
- This step applies to comedic/entertainment premises specifically (comedy,
  flirty one-liners, reaction bits, prank formats). It doesn't apply to
  factual claims in educational/wellness content — those still come from
  real research per the Trust Mechanism, not from joke-hunting.

## Step 2 — Write `character_take` (the load-bearing output)

This is the actual line(s) the character would say/do, written using
`speaking_style.md` + `humor_style.md`. Concretely:

- Take the `source_topic` (or `rough_topic` from a calendar day) as a neutral
  input — it is not automatically the tone of the output.
- Filter it entirely through the character's personality: check
  `humor_style.md`'s "Things to Avoid" list first. If the natural instinct for
  a topic would violate it (e.g. topic invites judgmental commentary but the
  character avoids mean-spirited humor), do not write the judgmental version —
  write the character's actual instinct instead (tease/deflect/joke), the same
  way the worked example in `content_dna/reaction_commentary.md` does.
- Write real, specific dialogue — not a description of dialogue. Wrong:
  `character_behavior: [teasing about her schedule]`. Right: an actual quoted line.

### Voice Check (do this before moving on — a recurring failure mode)

Read the line(s) back out loud in your head. If it sounds like something
printed in a textbook, a research abstract, or a teacher explaining something
to a class, it has failed, no matter how "on-topic" or factually correct it
is — rewrite it as something a specific person would actually blurt out to a
friend, with rhythm, imperfection, and personality, not exposition.

This applies even when a template phrasing is given elsewhere (e.g. the
Trust Mechanism's FACT/INTERPRETATION/OPINION structure in a wellness
character's `personality.md`) — the *structure* (keep fact/interpretation/
opinion distinguishable) is a hard requirement, but the *wording* is not a
script to copy verbatim. A FACT beat delivered as flat recitation
("มีงานศึกษาบอกว่าความเย็นช่วยลดอาการบวมได้ชั่วคราว") is a Voice Check failure
even though it's structurally correct — the same fact said the way she'd
actually say it to a friend ("มีคนบอกว่าเย็นๆแบบนี้ช่วยลดบวมได้ชั่วคราวนะ") passes.
Concretely, prefer:
- Contractions and casual particles over full formal sentences.
- A specific reaction/aside over a neutral statement — she has an opinion
  about what she's saying, so let it leak through even in the FACT beat's
  framing, not just the OPINION beat.
- Rhythm variation — not every line needs to be a complete grammatical
  sentence; a real person trails off, restarts, reacts mid-thought.
- If the line reads the same whether it's anong, momo, or a textbook author,
  it hasn't been filtered through the character enough — go back and make it
  something only *this* character would say, in *this* character's rhythm.

### Question-Target Check (mandatory for any Q&A-style premise — recurring failure, confirmed across 3+ items in one batch on 2026-09-05)

If the mechanic involves one party asking a question and the other
answering/reacting (POV Q&A, interview-style, off-screen-voice formats),
stop and check TWO things before finalizing the line — not just gender
consistency, but **who would actually be the one to start this exchange in
a real relationship dynamic**:

1. **Does the question make sense being asked of her specifically**, given
   who she is? A human reviewer's exact words: "ถ้าเป็น Q&A ก็ควรคิดสิว่า
   อนงคือคนโดนถาม และเป็นผู้หญิง ควรโดนถามและตอบยังไง" (she's the one being
   asked, and she's a woman — what would she actually be asked, and how
   would she actually answer). Confirmed failure: "what kind of *woman* do
   you like?" asked *of* Anong (a woman) — nonsensical/backwards. Fixed by
   reframing to ask about *her* perspective instead ("what kind of guy do
   you like?").
2. **Is the asker/answerer assignment realistic for this premise**, or was
   a question's grammatical shape copied from a reference example without
   checking who would naturally initiate it? Confirmed failure: a skeleton
   had the off-screen male ask "what's today's date?" and Anong reveal a
   hidden "you'll find out which day to be angry about" threat in response
   — but in a real relationship, **she'd** be the one testing **him** on
   whether he remembers an important date, not the reverse; a man randomly
   asking the date doesn't set up her hidden-anger reveal at all. The fix
   is to swap who speaks the opening line/question entirely, not just
   reword it — Anong becomes the asker ("วันนี้วันอะไรรู้ไหมคะ?"), his
   reaction/non-answer is what she's responding to, and her threat lands as
   the natural payoff of *her own* test.
   Also watch for **ambiguous kinship-pronoun self-reference** in the same
   failure family: Thai "พี่"/"หนู"/"น้อง" can be first- or second-person
   depending on who's speaking, so a line like "ถ้าพี่มีแฟนแล้วจะบอกหนูไหม"
   (spoken by the male, self-referring as "พี่") reads ambiguously — a
   reader/listener can't immediately tell if "พี่" means himself or is
   somehow addressing her. If a line depends on the reader tracking which
   kinship term is 1st vs 2nd person mid-sentence, rewrite it so the
   subject is unambiguous from context alone (e.g. reframe around *her*
   hypothetical instead: "ถ้าหนูมีแฟนแล้วจะบอกพี่ไหม?" — now "หนู"/"พี่"
   each map to exactly one person with no ambiguity).

Do this check for every Q&A item, not just ones that look obviously odd —
it's easy to copy a question's shape from a reference example (see
`format_bibles/pov_qa_reaction.md`'s Worked Dialogue Examples) without
noticing the roles have become identity-inconsistent or socially backwards
for who's actually in this scene.

## Step 3 — Business goal alignment

Read `business_goal.md`. Decide `cta_beat` (null/soft_cta/hard_cta) based on
`content_mix` — do not add a CTA to every item just because the character's
goal is `reach_to_fanvue`; respect the stated ratio. For `ugc_niche_mixed`
characters, `cta_beat` should be null far more often than not.

## Step 4 — Output

Produce `content_spec.yaml` (schema: `schemas/content_spec.yaml`), filling in
`source_reference` per Step 1.5 and `calendar_context` only if this came from
`content-calendar`.

## On retry (validation_report.retry_layer == content_director)

Re-read the specific `validation_report.checks.character` or `.content` notes
that failed — fix precisely that, don't regenerate from scratch discarding
what already passed (e.g. if only `character` failed, `content_category` and
`core_mechanic` likely don't need to change).
