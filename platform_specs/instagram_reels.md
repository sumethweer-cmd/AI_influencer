# Platform Spec: Instagram Reels

```yaml
aspect_ratio: "9:16"
resolution: "1080x1920"
max_duration_platform_limit: "20 minutes (platform cap)"
recommended_duration_for_reach: "under 90 seconds — the algorithm still favors short, fast-hook content despite the higher cap"
safe_zones: "keep key text/faces out of the top ~250px and bottom ~350px — covered by UI (caption, profile info, buttons)"
```

## Notes for format-router / comfyui-compiler
This is a *technical constraint* layer only — it does not decide camera/body
behavior (that's `format_bibles/`). It caps duration and dictates aspect ratio
and safe-zone placement for any on-screen text/overlay.

Source: platform-published specs, checked August 2026 — reconfirm if this file
is more than a few months old, these numbers change.
