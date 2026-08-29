# Business Goal: Anong

```yaml
goal: affiliate_commerce   # new goal type — distinct from momo's reach_to_fanvue and the generic ugc_niche_mixed
funnel_notes: "UGC affiliate content driving TikTok (organic + TikTok Shop) and Shopee purchases via wellness product curation. Attention layer = sexy/visual; value layer = wellness curation; monetization layer = UGC/affiliate."
content_mix: "rotate across all 5 pillars (Wellness Discovery, Simple Education, Product Curator, Lifestyle, Personality Entertainment) — explicitly do NOT over-index on selling/education pillars or the channel reads as 'sexy girl giving health lectures every day', which the source DNA doc calls out as a specific failure mode to avoid"
cta_style: "recommendation over pressure, per constraints.md — never hard-sell language"
explore_ratio: null   # 0.0-1.0, once content_performance_log exists (Phase 2)
```

## KPI Framework (from her own DNA doc — distinct from a single "views" metric)

Her source doc explicitly separates success into four KPI layers, which
maps directly onto the `content_performance_log` design discussed for this
project (Phase 2) — worth using Anong as the first character to actually
wire that up, since her own doc already anticipates it:

```
ATTENTION KPI    — did it get seen (views, reach)
RETENTION KPI    — did people watch through
TRUST KPI        — did the audience believe/engage with the content itself
CONVERSION KPI   — did it drive an actual TikTok Shop / Shopee purchase
```

Explicit risk called out in the source doc: high view count with a largely
male attention audience does not guarantee conversion — e.g. 100k views / 0
conversions is a real failure mode distinct from a smaller, more targeted
20k-view item with high conversion. Do not optimize content selection on
Attention KPI alone once real performance data exists.

## Platforms

**Confirmed: one clip, two destinations.** content-request produces a single
compiled item per piece of content — the same video gets distributed to both
TikTok and Shopee, not separately regenerated per platform. `delivery-format-
selector`/`comfyui-compiler` should pick technical constraints (aspect ratio,
duration, safe zones) that satisfy BOTH `platform_specs/tiktok.md` and
`platform_specs/shopee.md` at once (both are already 9:16/1080x1920/short-form,
so this is a non-issue in practice — the two specs don't actually conflict).
