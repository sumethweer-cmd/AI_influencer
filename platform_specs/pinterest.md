# Platform Spec: Pinterest (Idea Pins / Video Pins)

```yaml
aspect_ratio: "2:3 (image pins); 9:16 (Idea Pins/video)"
resolution: "1000x1500 (image pins); 1080x1920 (video)"
max_duration_platform_limit: "not strictly published — keep video pins short by convention"
recommended_duration_for_reach: "under 60 seconds"
safe_zones: "keep key text away from the bottom ~15% — covered by save/board UI"
```

## Notes for format-router / comfyui-compiler
Pinterest is also the platform most likely to use `delivery_format: image_set`
(single strong image) rather than video — don't assume video_clip by default here.

Source: platform-published specs, checked August 2026 — reconfirm if this file
is more than a few months old, these numbers change.
