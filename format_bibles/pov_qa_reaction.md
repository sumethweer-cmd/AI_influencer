# Format Bible: POV Q&A Reaction

Source: real production brief (revision of the "No/No/No/No/Yes" silent
reaction concept, 2026-09-01, now with an off-screen male voice asking the
questions). Combines `pov_comedy.md`'s camera-is-a-person convention with
`silent_reaction_beats.md`'s discrete-numbered-beat structure — the
difference from that file is the two things it explicitly forbids
(dialogue, direct eye contact) are exactly what this variant requires.

```
Camera:
- POV — the camera IS the off-screen male character (S2). He is never
  seen, never gets a <Picture N> reference (per model_specs/minimax-h3.md:
  an off-screen second speaker never needs a Picture reference if he stays
  off-screen the whole clip)
- Fixed/steady framing, one cut per beat, same as silent_reaction_beats

Eyes:
- OPPOSITE of silent_reaction_beats: she looks at the lens throughout,
  because the lens IS the person she's responding to — per pov_comedy.md,
  "Direct to lens = looking at the implied other person." Looking away
  would break the POV conceit here, not preserve it.

Dialogue:
- (S2), the off-screen male, asks/states each item as a real spoken line
  — numbers are said aloud, not shown as on-screen text/graphics (unlike
  silent_reaction_beats, where they're composited in afterward)
- Anong (S1) reacts physically and silently to each stated item except
  the final beat, where she delivers the punchline line herself
- Every line — his and hers — still needs pacing description and a
  numeric-duration pause around it, same hard requirement as any other
  H3 item

Body:
- Same restrained, natural, readable reaction language as
  silent_reaction_beats for the repeated "no" beats (head-shake, no
  pointing, no exaggerated gestures)
- The final beat is played toward the camera-as-person specifically — a
  playful, slightly flirty delivery toward "him," not toward a general
  audience

Pacing:
- Same beat structure as silent_reaction_beats: repeated near-identical
  reactions (each with distinct micro-detail) building anticipation
  toward a distinct final tonal shift
- The second-to-last beat is HIS question, not her reaction — give it its
  own beat/shot rather than folding it into the reaction before or after
```

## Common Failure Patterns
- Looking away from the lens during her reactions — that reads as
  ignoring the person she's supposedly responding to, breaking the POV
  premise this format depends on (the opposite problem from
  `silent_reaction_beats.md`, so don't default to that file's eye rule
  out of habit).
- Giving the off-screen male a `<Picture N>` reference — he's POV/never
  seen, exactly like the off-screen friend pattern in
  `model_specs/minimax-h3.md`.
- Writing the spoken numbers as on-screen text/graphics instead of actual
  `<d>` dialogue lines — in this variant they're said aloud, not
  composited in post.

## Best Suited For
`reaction_commentary`, `flirty` — playful Q&A/interview-style bits where
an unseen interviewer (voiced via S2) feeds items to react to, building to
a punchline she delivers herself, addressed to him/the lens.

## Worked Dialogue Examples (human-approved reference set, 2026-09-05)

These passed direct human review as hitting the target: hook immediate, the
situation is legible within the first line, the punchline lands within
roughly 3-6 seconds, and — critically — the reaction/silence is doing the
comedic work rather than more dialogue being added on top of it. Use these
as the calibration bar for new `character_take` writing in this format, not
just the abstract rules above.

Guiding philosophy stated alongside the last three: don't try to make every
clip a quotable one-liner/aphorism — write it as an ordinary-sounding
question whose answer the viewer doesn't see coming. That's the situational-
humor principle (see `content-director.md` Step 1.5) applied specifically to
this format's Q&A shape.

1. **ถ้าเลือกได้ระหว่างแฟนกับเงิน** — ชาย: "ถ้าให้เลือกระหว่างพี่กับเงิน 10
   ล้าน?" → อนง: "เงินค่ะ" → ชาย: "ถ้าพี่มี 10 ล้านล่ะ?" → อนง: "พี่ค่ะ" —
   *double-twist, easy to follow: the first answer looks like a rejection,
   the second flips it into a compliment.*
2. **ตอบแชทช้า 3 ชั่วโมง** — ชาย: "เมื่อกี้ตอบช้า ขอโทษนะ" → "โกรธเหรอ?" →
   อนง: "ไม่โกรธค่ะ" → (เว้นจังหวะ) → "แต่จำไว้แล้วนะ" — *relatable pain point
   + the held pause before the line does more than the words would alone.*
3. **คนคุยที่ไม่ยอมเรียกแฟน** — ชาย: "ตกลงเราเป็นอะไรกัน?" → "คนคุยค่ะ" →
   "คุยกับหนูคนเดียวไหม?" → (เงียบ) → "อ๋อ...เข้าใจแล้วค่ะ" — *silence carries
   the answer to an unasked follow-up question; nothing extra needed.*
4. **กินอะไรก็ได้** (Couple POV variant) — ชาย: "วันนี้กินอะไรก็ได้?" → อนง:
   "ชาบู?" → "ไม่เอา" → "หมูกระทะ?" → "ไม่เอา" → "แล้วอะไรก็ได้คืออะไร?" →
   "ที่ไม่ใช่สองอันนั้น" — *everyday Thai relationship humor, no wordplay,
   just a shared universal experience.*
5. **เดี๋ยวพี่เลี้ยงเอง** — ชาย: "วันนี้พี่เลี้ยงเอง" → (อนงดีใจ) → ชาย: "แต่
   เลี้ยงครึ่งเดียวนะ" → อนง: "อ๋อ...เลี้ยงครึ่งหนึ่ง" — *plays against
   expectation: the offer inflates hope, the qualifier deflates it.*
6. **ผู้ชายบอกว่า 'ชอบผู้หญิงไม่แต่งหน้า'** — ชาย: "พี่ชอบผู้หญิงไม่แต่งหน้า
   นะ" → "จริงเหรอ?" → "จริง" → (อนงเช็ดปาก/เช็ดตาเป็นสัญลักษณ์ล้างเมคอัพ)
   "งั้นวันนี้หนูไม่แต่งแล้วนะคะ" → (ชายเงียบ) — *visual reaction carries the
   punchline; his silence at the end is the joke, not a line.*
7. **ผู้ชายจำวันสำคัญไม่ได้** — ชาย: "วันนี้วันเท่าไหร่นะ?" → (อนงมองหน้า)
   "ไม่เป็นไรค่ะ" → (ชายโล่งใจ) → อนง: "เดี๋ยวพี่จะได้รู้ว่าจะโกรธวันไหน" —
   *short setup + a threat delivered sweetly (the mismatch between tone and
   content is the joke).*
8. **"หนูชอบผู้ชายแบบไหน?"** (corrected 2026-09-05) — ชาย: "หนูชอบผู้ชายแบบ
   ไหน?" → อนง: "แบบที่ไม่มีวันได้ค่ะ" → "ทำไม?" → "เพราะหนูมีแฟนแล้ว" —
   *ordinary question, answer the viewer doesn't see coming until the
   follow-up.* Originally drafted as "พี่ชอบผู้หญิงแบบไหน?" (asking anong, a
   woman, what type of *woman* he likes) — a human reviewer flagged that this
   didn't make sense, since the question's framing conflicted with her own
   identity in the scene. Fix: ask about her type of *guy* instead — same
   reveal/payoff (she's "off the market" because she already has a
   boyfriend), now logically addressed to her. **Lesson**: when a Q&A
   premise has the off-screen character ask about a category the on-screen
   character herself belongs to, double-check the question still makes
   sense being asked of her specifically, not just as an abstract template.
9. **"หนูหึงไหม?"** — ชาย: "หนูเป็นคนขี้หึงไหม?" → "ไม่ค่ะ" → "จริงเหรอ?" →
   "หนูแค่จำหน้าผู้หญิงทุกคนที่พี่ follow ได้" — *denies the premise, then the
   follow-up detail proves the opposite — classic situational reveal.*
10. **"ถ้าพี่มีแฟนแล้วจะบอกไหม?"** — ชาย: "ถ้าพี่มีแฟนแล้วจะบอกหนูไหม?" →
    อนง: "บอกค่ะ" → "ว่า?" → "ว่าหนูจะเป็นอะไรกับพี่ต่อ" — *answers the literal
    question in a way that redefines what was actually being asked.*
