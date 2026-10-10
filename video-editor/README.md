# video-editor — vertical-drama episode editor

Turns an episode folder (`vdo/EPxx-Cyy.mp4` clips + `prompts/Cyy.txt`) into one finished 1080x1920 MP4:

`hook (2 highlights) -> episode card (EP.xx + title) -> main story (EP tag on top) -> end card (like / follow)`

```
.venv\Scripts\python.exe -I drama_edit.py "C:\vert drama\น้ำท่วม\EP01" transcribe   # Whisper (cached)
.venv\Scripts\python.exe -I drama_edit.py "C:\vert drama\น้ำท่วม\EP01" plan         # align prompt lines, VAD-snap, trims, takes
.venv\Scripts\python.exe -I drama_edit.py "C:\vert drama\น้ำท่วม\EP01" highlights   # ranked hook candidates (then pick: see skill)
.venv\Scripts\python.exe -I drama_edit.py "C:\vert drama\น้ำท่วม\EP01" graphics     # HyperFrames templates -> graphics\renders
.venv\Scripts\python.exe -I drama_edit.py "C:\vert drama\น้ำท่วม\EP01" render       # -> <ep>\edit\EPxx_v2.mp4
.venv\Scripts\python.exe -I check_render.py "C:\vert drama\น้ำท่วม\EP01"            # loudness + join/subtitle/open/end sheets
```

Config
- `<series>\_series\series.json`: series title, accent colour, end-card headline (shared by all episodes).
- `<ep>\edit\ep.json`: `ep`, `title`, `next_ep_text`, `highlights` (see `.claude/skills/drama-highlight-picker`), `banners` (text cards over a clip, e.g. the WFH notification), optional `cover` image for the end card.
- `<ep>\edit\work\overrides.json`: `out` (per-clip trim end), `crf`, `no_graphics`.
- Scene list / alternate takes (`SCENES`, `ALT_TAKES`) are at the top of `drama_edit.py`; edit them per episode.

How it works
- Whisper (faster-whisper `small`, CPU) gives rough word times; the lines the generator was PROMPTED with are the
  subtitle text. An order-preserving DP aligns them, then each line is snapped to the Silero VAD speech spans
  (Whisper alone was up to 2 s early on this footage).
- Alternate takes are chosen by closeness to the prompt. Trim tails to the prompt's planned end, never closer than 0.45 s to speech.
- Hard cuts inside a scene, 0.3 s dissolve between scenes, hook->card 0.3 s, story->end card 0.5 s.
- Graphics are HyperFrames compositions in `graphics\` (`ep-card.html`, `end-card.html`, `tag.html`), parameterised by variables, pinned to hyperframes 0.8.143. Tags render as transparent WebM and are overlaid with ffmpeg (`-c:v libvpx-vp9` decoder).
- Loudness: two-pass loudnorm to -14 LUFS / -1 dBTP. Output H.264 crf 16, AAC 320k, 48 kHz, faststart.

Needs: ffmpeg (winget `Gyan.FFmpeg`), Node 22+, Chrome, `.venv` with faster-whisper + numpy, Windows font Leelawadee UI.
