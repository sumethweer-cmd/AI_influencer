# Business Goal: Momo

```yaml
goal: reach_to_fanvue
funnel_notes: "reach+engagement content to drive traffic to Fanvue/subscriptions"
content_mix: null   # TODO — exact ratio (e.g. "80% reach content, 20% soft CTA") not yet specified
cta_style: null      # TODO — if/when a CTA beat is used, it must still pass through her
                      # "ambiguity over explicitness" and "flirting is an accent"
                      # principles from humor_style.md — never generic ad copy
explore_ratio: null   # 0.0-1.0 — % of content that tries an unproven combo vs
                        # a proven one, once content_performance_log exists (Phase 2)
```

## Notes for content-calendar / content-director

Since the goal is `reach_to_fanvue`: weekly calendars should lean toward
delivery formats that reach new audiences (`video_clip`/reels over static
posts), per `content-calendar/SKILL.md`'s guidance for this goal type. Until
`content_mix` is set explicitly, don't force a CTA beat on every item —
default `cta_beat` to `null` unless the user asks for one on a specific item,
since an unspecified ratio shouldn't be guessed as "every post."

Also still open: `constraints.md`'s `nsfw_allowed` field — a `reach_to_fanvue`
goal commonly implies an NSFW tier gated behind the subscription, but that's a
real content-policy decision, not something to infer from the goal alone.
