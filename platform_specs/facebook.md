# Platform Spec: Facebook (Reels/Feed)

```yaml
aspect_ratio: "9:16 (Reels); 4:5 or 1:1 also common for Feed posts"
resolution: "1080x1920 (Reels)"
max_duration_platform_limit: "same Reels limits as Instagram (Meta-shared infrastructure) — verify current cap"
recommended_duration_for_reach: "under 90 seconds"
safe_zones: "keep key text/faces out of the top ~250px and bottom ~350px, same as Instagram Reels"
```

## Notes for format-router / comfyui-compiler
Facebook and Instagram Reels share Meta's delivery pipeline — when in doubt,
these two specs should be kept in sync.

Source: platform-published specs, checked August 2026 — reconfirm if this file
is more than a few months old, these numbers change.
