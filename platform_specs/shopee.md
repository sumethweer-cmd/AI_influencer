# Platform Spec: Shopee (Shopee Video / affiliate)

```yaml
aspect_ratio: "9:16"
resolution: "1080x1920"
max_duration_platform_limit: "not strictly published — Shopee Video/affiliate clips convention is short-form, similar to TikTok"
recommended_duration_for_reach: "under 60 seconds"
safe_zones: "keep key text/product callouts away from the bottom ~20% — covered by the product-card/cart UI Shopee overlays on video content"
```

## Notes for format-router / comfyui-compiler
Commerce-first platform — unlike the reach platforms (`instagram_reels.md`,
`tiktok.md`), content here is expected to end on or clearly point to a
product, and the safe-zone constraint is driven by Shopee's own shopping UI
(product card), not just standard caption/UI overlap.

## Notes for delivery-format-selector
Pairs naturally with `content_dna/product_review.md` and `affiliate.md`.
`image_set` is also common here for simple product-showcase posts, not just video.

Source: general Shopee/affiliate-video convention, not a platform-published
spec sheet (Shopee doesn't publish detailed creator specs the way
Meta/TikTok/YouTube do) — treat the numbers above as reasonable defaults,
confirm against actual Shopee Affiliate/Shopee Video creator docs before
relying on them for anything precise (exact duration caps, file size limits).
