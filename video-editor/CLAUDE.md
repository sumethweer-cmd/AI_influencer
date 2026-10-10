# video-editor (vertical-drama episode editor)

Read `HANDOFF.md` first: it has the full workflow, the exact specs used in EP01 (fonts, sizes, colours, loudness, transitions)
and the lessons learned. `README.md` is the short command reference.

Rules of thumb for this folder
- Subtitle TEXT comes from the clip prompts (`<d>[Thai] ...</d>`), never from Whisper; Whisper/VAD only supply timing.
- Never commit videos, `.venv`, `graphics/renders`, or Microsoft fonts (see `.gitignore`).
- Always show the user a plan/preview before a full render, render only what changed, and say what could not be verified
  (Claude cannot listen to audio).
- Run Python as `.venv\Scripts\python.exe -I drama_edit.py "<ep_dir>" <stage>`.
