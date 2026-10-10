---
name: drama-highlight-picker
description: Pick the 2-3 highlight shots that open a vertical-drama episode (the hook before the episode title card). Use when packaging an episode of a vertical drama (e.g. "เลือก highlight ep นี้", "ทำ hook ให้ EP02", "pick the teaser for this episode") after the clips have been planned by video-editor/drama_edit.py. Produces the "highlights" list in <ep>/edit/ep.json.
metadata:
  version: 1.0.0
---

# Drama Highlight Picker

The episode opens with a 4-7 second **hook**: two or three of the episode's best moments, cut hard, with Thai subtitles and the series title tag, then a dissolve into the episode card (`EP.xx` + title) and the main story. The hook is the first thing a viewer sees on TikTok/Reels, so it decides whether they stay.

## Inputs
- `<ep>/edit/work/plan.json` (written by `python -I drama_edit.py <ep> plan`): every spoken line with refined speech start/end (`rstart`/`rend`), speaker, and alignment `ratio`.
- `python -I drama_edit.py <ep> highlights` prints ranked candidates (heuristic score). It is a **shortlist, not the answer**: always read the lines and decide.
- `<ep>/script.md` and `<ep>/prompts/Cxx.txt` for context (what each beat is, where the episode's punchline sits).

## What makes a good highlight
1. **Works with zero context.** A viewer who has not seen the episode must get the joke/tension from the clip alone. Prefer a self-contained retort, a question that begs an answer, or an emotional beat with a clear reaction.
2. **Does not spoil.** Never use the episode's closing beat or punchline (the last 15% of the story, the final line of the final clip). A hook should open a question the main story answers.
3. **Short and clean.** Each shot 1.5-3 s of speech (+0.3 s lead and tail are added automatically). Whole hook <= 7 s. Two shots is usually enough; a third only if it is a silent visual beat.
4. **Varied.** Different clips, different emotion or speaker. Do not pick two lines from the same exchange.
5. **Strongest first.** The first 1-2 seconds decide retention. Order by impact, not by story order, unless the order tells a mini-story (setup line then reaction).
6. **Safe to cut.** Prefer lines with `refined` speech timing and `ratio >= 0.8`. Avoid lines whose Whisper match was weak (`unrefined`) - the cut may clip a word.
7. **Visually legible.** Faces visible, mouth moving on the line; avoid shots where the speaker is off-screen or the frame is a pure transition.

## Procedure
1. Run `plan` (and `highlights`) for the episode.
2. Read the top ~12 candidates plus `script.md`. Drop anything in the spoiler zone, anything that needs context, anything too long.
3. Pick 2 (max 3). Write them to `<ep>/edit/ep.json`:
   ```json
   "highlights": [
     {"clip": "C03",  "start": 4.20, "end": 6.16, "why": "dry comeback, funny with no context"},
     {"clip": "C10b", "start": 5.16, "end": 6.80, "why": "the romantic spark, no spoiler"}
   ]
   ```
   `start`/`end` are the speech span (`rstart`/`rend`) of the line(s); optional `lead`/`tail` override the default 0.3 s padding (shorten `lead` if the previous word is closer than 0.3 s).
4. Render (`graphics` then `render`) and look at the first 6 s: frames of the hook, tag overlay not covering faces, subtitles in the bottom fifth, no clipped words (check `check_render.py` `_open.png`).
5. Report the choice and the reason to the user in one line per shot, and offer one alternative.

## Don't
- Don't add music or voice-over to the hook; it uses the clips' own audio.
- Don't pick a line only because the heuristic scored it high (the score cannot see the joke).
- Don't extend the hook to "fit more in"; trim instead.
