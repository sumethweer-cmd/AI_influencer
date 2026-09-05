# Visual Personality: Anong

## Sexy DNA (locked level — don't escalate beyond this)

```
SEXY FASHION + SEXY CASUAL
```

**Sexy Fashion**: fitted clothing, fashion-forward, beach/resort fashion,
sporty-sexy, stylish casual, dresses, fitness-inspired fashion. She dresses
sexy because that's her style — **not** to seduce the viewer in every clip.

**Sexy Casual**: everyday-attractive — tank tops, fitted tees, crop tops,
casual dresses, athleisure, oversized shirt with shorts. Behavior does not
need to match the outfit's sexiness.

### Core Principle: LOOK SEXY ≠ ACT SEXUAL

She can be discussing "ทำไมเรานอนไม่พอแล้ววันรุ่งขึ้นหิวมากกว่าปกติ" (why not
sleeping enough makes you hungrier the next day) while wearing something
sexy — this is **Visual Packaging + Informational Content**, not seduction.
`prompt-enhancer` should keep her behavior matched to whatever
`content_dna` category the item is (educational, curator, lifestyle...), and
let the outfit/visual layer carry the sexy attention on its own — never make
her *act* more sexual to match how she's dressed.

## Style Palette

Soft / Natural / Feminine / Minimal. Reference swatches: peach, warm
gold/mustard, blush pink, soft lavender-grey, warm brown. Outfits/settings
should read as this palette, not high-saturation or "loud."

## Default Aesthetic (from the reference images)

Natural, warm, lifestyle-photography feel — not studio/editorial. Settings:
cozy home interiors, cafés, beach/resort, outdoor daylight — consistent
with a "curator sharing her actual life" premise, not a staged set.

**Actually vary the setting — don't default to "cozy home interior corner"
every time.** Confirmed failure (2026-09-05): a batch of 10 items in one
sitting independently invented near-identical "cozy home living-room corner
in soft warm evening lighting" settings, because that's the safest-sounding
option when no specific setting is given — the result read as repetitive
and lazy across the batch. Before writing a setting, check what other items
already scheduled/generated nearby (same day/week) used, and deliberately
pick a *different* one from the list above (café, beach/resort, outdoor
daylight, or a genuinely different room/corner of the home — kitchen,
balcony, bedroom vanity, car) rather than reaching for the same living-room
default reflexively. "Cozy home interior" is one option among several, not
the fallback for every item.

## Prompt Enhancer Guidance

**Prefer**: natural smile with visible teeth or a soft closed-mouth smile,
warm expressive eyes, relaxed/candid posture, hand-to-face or hair-touch
gestures, genuine reactions.

**Avoid**: overtly seductive posing (this is not her mode even in "sexy
casual" outfits — see LOOK SEXY ≠ ACT SEXUAL above), stiff/posed "photoshoot"
energy, exaggerated expressions.

## Format Fit
TODO — cross-check against `format_bibles/*.md` once real content is
produced; her curator/educator content likely suits `tripod_casual` and
`selfie_cam` well (direct-to-camera explaining), `mirror_selfie`/`grwm` for
lifestyle pillar items.
