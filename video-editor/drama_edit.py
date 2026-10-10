"""Vertical-drama episode editor.

Pipeline (one episode folder in, one finished MP4 out):
  transcribe - faster-whisper (local, CPU) on every clip in <ep>/vdo -> word timestamps
  plan       - align the lines the generator was PROMPTED with (<d>[Thai] ...</d> in <ep>/prompts/Cxx.txt)
               to the Whisper words (Whisper only says roughly WHEN; the prompt says WHAT), then snap each
               line to the Silero speech spans so subtitle/cut timing is accurate, pick takes, trims
  graphics   - render the reusable HyperFrames templates (episode card, title tags, end card) for this episode
  render     - ONE ffmpeg graph:  hook (highlights) -> dissolve -> episode card -> main episode
               -> dissolve -> end card, Thai subtitles, tag overlays, two-pass loudness normalisation

Usage:  python -I drama_edit.py <ep_dir> [transcribe|plan|highlights|graphics|render|all] [output_name]
Config: <ep_dir>/../_series/series.json   (series title, accent, end-card headline)
        <ep_dir>/edit/ep.json             (ep number/title, highlights, banners, next-episode line,
                                           scenes / alt_takes: override SCENES / ALT_TAKES below)
"""
import difflib
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
GFX = HERE / "graphics"
HF_VERSION = "0.8.143"

W, H, FPS = 1080, 1920, 24
WHISPER_MODEL = "small"
LUFS, TP = -14.0, -1.0
SCENE_FADE = 0.30          # dissolve between scenes of the main story
HOOK_FADE = 0.30           # hook -> episode card
END_FADE = 0.50            # main story -> end card
FINAL_FADE = 0.5
TAIL_PAD = 0.45            # keep this much after the last spoken word
PLANNED_END_PAD = 0.15
HOOK_LEAD, HOOK_TAIL = 0.30, 0.30
TAG_LEN = 3.4
FONT_FILES = ["LeelawUI.ttf", "LeelaUIb.ttf"]
FONT_FAMILY = "Leelawadee UI"

# scene = run of clips shot continuously; dissolves go between scenes
SCENES = [["C01", "C02", "C03", "C04", "C05"],
          ["C06", "C07", "C08", "C09", "C10"],
          ["C11", "C12"]]
ALT_TAKES = {"C10": ["C10a", "C10b"]}


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return str(Path(exe).parent)
    hits = glob.glob(str(Path.home() / "AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*/ffmpeg-*/bin"))
    if hits:
        return hits[0]
    sys.exit("ffmpeg not found")


FFDIR = find_ffmpeg()
FFMPEG = str(Path(FFDIR) / "ffmpeg.exe") if (Path(FFDIR) / "ffmpeg.exe").exists() else "ffmpeg"
FFPROBE = str(Path(FFDIR) / "ffprobe.exe") if (Path(FFDIR) / "ffprobe.exe").exists() else "ffprobe"


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, encoding="utf-8", **kw)


def duration_of(path):
    return float(run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).stdout.strip())


def clip_key(path):
    return re.search(r"-(C\d+[a-z]?)\.mp4$", Path(path).name).group(1)


def load_json(path, default=None):
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def configs(ep):
    series = load_json(ep.parent / "_series" / "series.json", {})
    series.setdefault("title", ep.parent.name)
    series.setdefault("accent", "#FFC933")
    series.setdefault("end_headline", "ชอบตอนนี้ไหม?")
    epc = load_json(ep / "edit" / "ep.json", {})
    m = re.search(r"(\d+)", ep.name)
    epc.setdefault("ep", int(m.group(1)) if m else 1)
    epc.setdefault("title", "")
    epc.setdefault("highlights", [])
    epc.setdefault("banners", [])
    epc.setdefault("next_ep_text", f"ตอนต่อไป EP.{epc['ep'] + 1:02d} เร็วๆ นี้")
    return series, epc


# ---------------------------------------------------------------- transcribe
def read_wav(path):
    import numpy as np
    with wave.open(str(path), "rb") as wf:
        return np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def stage_transcribe(ep, work):
    from faster_whisper import WhisperModel
    wdir = work / "whisper"
    wdir.mkdir(parents=True, exist_ok=True)
    model = None
    for mp4 in sorted((ep / "vdo").glob("EP*-C*.mp4")):
        key = clip_key(mp4)
        out = wdir / f"{key}.json"
        wav = wdir / f"{key}.wav"
        if not wav.exists():
            run([FFMPEG, "-y", "-v", "error", "-i", str(mp4), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
        if out.exists():
            continue
        if model is None:
            model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        segs, _ = model.transcribe(read_wav(wav), language="th", word_timestamps=True, vad_filter=True)
        words = [{"w": w.word, "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in (s.words or [])]
        out.write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
        print("transcribed", key, len(words), "words", flush=True)


# ---------------------------------------------------------------- prompt parsing
def parse_prompt(path):
    text = Path(path).read_text(encoding="utf-8")
    lines = []
    for m in re.finditer(r"<d>\[Thai\]\s*(.*?)</d>", text, re.S):
        before = text[max(0, m.start() - 350):m.start()]
        who = "Thana" if before.rfind("Thana") > before.rfind("Meena") else "Meena"
        lines.append({"speaker": who, "text": m.group(1).strip()})
    ends = re.findall(r"ends at about 00:(\d+(?:\.\d+)?)", text)
    return lines, (float(ends[-1]) if ends else None)


def norm(s):
    return re.sub(r"[\s\u2026.,!?\"'“”‘’\-–]+", "", s)


def split_line(text):
    """Split a prompted line at ellipses so long lines with pauses get their own timing;
    pieces shorter than 4 characters are glued to a neighbour."""
    parts = [p for p in re.split(r"…|\.\.\.", text) if p.strip()]
    if len(parts) <= 1:
        return [text]
    merged = []
    for p in parts:
        if merged and len(norm(merged[-1])) < 4:
            merged[-1] = merged[-1].strip() + "…" + p.strip()
        else:
            merged.append(p.strip())
    if len(merged) > 1 and len(norm(merged[-1])) < 4:
        merged[-2] = merged[-2] + "…" + merged[-1]
        merged.pop()
    if text.lstrip().startswith("…"):
        merged[0] = "…" + merged[0]
    return merged


# ---------------------------------------------------------------- alignment
def align(expected, words, max_win=60):
    """Order-preserving DP: assign each expected line a window of Whisper words.
    gain = (similarity - 0.4) * length, so a bad match scores below skipping the line."""
    n, K = len(words), len(expected)
    wn = [norm(w["w"]) for w in words]
    NEG = -1e9
    gain = {}
    for k, ex in enumerate(expected):
        e = norm(ex["text"])
        for i in range(n):
            acc = ""
            for j in range(i, min(n, i + max_win)):
                acc += wn[j]
                if acc:
                    r = difflib.SequenceMatcher(None, e, acc).ratio()
                    gain[(k, i, j)] = ((r - 0.4) * max(len(e), 1), r)
    f = [[NEG] * (n + 1) for _ in range(K + 1)]
    back = [[None] * (n + 1) for _ in range(K + 1)]
    for p in range(n + 1):
        f[0][p] = 0.0
    for k in range(K):
        for q in range(n + 1):
            best, bp = NEG, None
            if q > 0 and f[k + 1][q - 1] > best:
                best, bp = f[k + 1][q - 1], ("carry",)
            if f[k][q] > best:
                best, bp = f[k][q], ("skip",)
            if q > 0:
                j = q - 1
                for i in range(max(0, j - max_win + 1), j + 1):
                    g = gain.get((k, i, j))
                    if g and g[0] > 0 and f[k][i] + g[0] > best:
                        best, bp = f[k][i] + g[0], ("match", i, j)
            f[k + 1][q], back[k + 1][q] = best, bp
    res = [None] * K
    k, q = K, n
    while k > 0:
        bp = back[k][q]
        if bp[0] == "carry":
            q -= 1
        elif bp[0] == "skip":
            k -= 1
        else:
            _, i, j = bp
            res[k - 1] = (i, j)
            q, k = i, k - 1
    out = []
    for k, ex in enumerate(expected):
        if res[k] is None:
            out.append({**ex, "matched": False, "ratio": 0.0})
        else:
            i, j = res[k]
            out.append({**ex, "matched": True, "ratio": round(gain[(k, i, j)][1], 2),
                        "start": words[i]["s"], "end": words[j]["e"],
                        "heard": "".join(w["w"] for w in words[i:j + 1]).strip()})
    return out


def speech_spans(wav):
    """Silero VAD (bundled with faster-whisper): accurate speech spans, robust to ambience."""
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    opts = VadOptions(threshold=0.5, min_speech_duration_ms=120, min_silence_duration_ms=120, speech_pad_ms=20)
    return [(c["start"] / 16000, c["end"] / 16000) for c in get_speech_timestamps(read_wav(wav), opts)]


def refine(lines, spans):
    """Whisper's word times are loose (often 0.2-2 s early at the start). Snap each aligned line to the
    VAD span(s) it overlaps. A span shared with a neighbouring line keeps Whisper's boundary there."""
    prev_end = -1.0
    for l in lines:
        if not l["matched"]:
            continue
        ws, we = l["start"], l["end"]
        cand = [s for s in spans if s[1] > ws + 0.05 and s[0] < we - 0.05]
        l["rstart"], l["rend"], l["refined"] = ws, we, False
        if cand:
            first, last = cand[0], cand[-1]
            start = first[0] if (first[0] >= ws - 0.05 or prev_end <= first[0]) else max(ws, prev_end)
            end = last[1] if last[1] <= we + 0.4 else we
            if end - start > 0.15:
                l["rstart"], l["rend"], l["refined"] = round(start, 3), round(end, 3), True
        prev_end = l["rend"]
    return lines


# ---------------------------------------------------------------- plan
def stage_plan(ep, work):
    wdir = work / "whisper"
    _, epc = configs(ep)
    scenes = epc.get("scenes") or SCENES              # per-episode override lives in ep.json
    alt_takes = epc.get("alt_takes") or ALT_TAKES
    clips = {}
    for mp4 in sorted((ep / "vdo").glob("EP*-C*.mp4")):
        key = clip_key(mp4)
        base = re.match(r"C\d+", key).group(0)
        pr = ep / "prompts" / f"{base}.txt"
        if not pr.exists():
            continue
        lines, planned = parse_prompt(pr)
        expected = [{"speaker": ln["speaker"], "text": piece} for ln in lines for piece in split_line(ln["text"])]
        words = json.loads((wdir / f"{key}.json").read_text(encoding="utf-8"))
        aligned = refine(align(expected, words), speech_spans(wdir / f"{key}.wav"))
        clips[key] = {"file": str(mp4), "base": base, "duration": duration_of(mp4), "planned_end": planned, "lines": aligned}

    chosen = {}
    for base, opts in alt_takes.items():
        def score(k):
            ls = clips[k]["lines"]
            return sum(l["ratio"] * len(norm(l["text"])) for l in ls) / max(1, sum(len(norm(l["text"])) for l in ls))
        scores = {k: round(score(k), 3) for k in opts if k in clips}
        chosen[base] = {"pick": max(scores, key=lambda k: (scores[k], k)), "scores": scores}

    segs = []
    for si, scene in enumerate(scenes):
        for base in scene:
            key = chosen[base]["pick"] if base in chosen else base
            c = clips[key]
            ends = [l["rend"] for l in c["lines"] if l["matched"]]
            starts = [l["rstart"] for l in c["lines"] if l["matched"]]
            last_end = max(ends or [0.0])
            out_t = c["duration"]
            if c["planned_end"]:
                out_t = min(out_t, max(c["planned_end"] + PLANNED_END_PAD, last_end + TAIL_PAD))
            segs.append({"clip": key, "scene": si, "in": 0.0, "out": round(out_t, 3),
                         "first_speech": min(starts or [9.9]), "last_speech": last_end})
    plan = {"episode": str(ep), "chosen_takes": chosen, "segments": segs, "clips": clips}
    (work / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"plan written: {len(segs)} segments; takes: {chosen}")
    for k in sorted(clips):
        c = clips[k]
        print(f"\n{k} dur={c['duration']:.2f} planned_end={c['planned_end']}")
        for l in c["lines"]:
            if l["matched"]:
                print(f"  whisper {l['start']:5.2f}-{l['end']:5.2f} -> speech {l['rstart']:5.2f}-{l['rend']:5.2f}"
                      f"{'' if l['refined'] else ' (unrefined)'} r={l['ratio']:.2f} {l['speaker']}: {l['text']}")
            else:
                print(f"  [UNMATCHED] {l['speaker']}: {l['text']}")


# ---------------------------------------------------------------- highlight candidates
def stage_highlights(ep, work):
    """Ranked highlight candidates (see .claude/skills/drama-highlight-picker). The human/agent picks."""
    plan = json.loads((work / "plan.json").read_text(encoding="utf-8"))
    order = [s["clip"] for s in plan["segments"]]
    total = len(order)
    units = []
    for ci, key in enumerate(order):
        ls = [l for l in plan["clips"][key]["lines"] if l["matched"]]
        i = 0
        while i < len(ls):
            unit = [ls[i]]
            while i + 1 < len(ls) and ls[i + 1]["speaker"] != unit[-1]["speaker"] and ls[i + 1]["rstart"] - unit[-1]["rend"] < 1.3 \
                    and ls[i + 1]["rend"] - unit[0]["rstart"] < 5.0:
                i += 1
                unit.append(ls[i])
            i += 1
            text = " / ".join(u["text"] for u in unit)
            n = len(norm(text))
            score = 0.0
            score += 2.0 if re.search(r"[?!]", text) else 0.0
            score += 1.5 if len(unit) > 1 else 0.0
            score += 1.0 if 8 <= n <= 36 else (-1.5 if n < 4 else 0.0)
            score += 1.0 * min(l["ratio"] for l in unit) - 0.5
            pos = ci / max(1, total - 1)
            if pos > 0.85:
                score -= 3.0       # spoiler zone: the closing beat belongs to the ending
            if pos < 0.1:
                score -= 1.0       # set-up lines rarely hook
            if not all(u["refined"] for u in unit):
                score -= 1.0
            units.append({"clip": key, "start": round(unit[0]["rstart"], 2), "end": round(unit[-1]["rend"], 2),
                          "text": text, "score": round(score, 2)})
    units.sort(key=lambda u: -u["score"])
    for u in units[:14]:
        print(f"{u['score']:5.2f}  {u['clip']:5} {u['start']:5.2f}-{u['end']:5.2f}  {u['text']}")


# ---------------------------------------------------------------- graphics (HyperFrames templates)
def run_hyperframes(args):
    npx = shutil.which("npx")
    cmd = ["cmd", "/c", npx, "--yes", f"hyperframes@{HF_VERSION}", *args]
    env = {**os.environ, "PATH": FFDIR + os.pathsep + os.environ.get("PATH", "")}
    r = subprocess.run(cmd, cwd=GFX, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print(r.stdout[-2500:], r.stderr[-2500:])
        sys.exit("hyperframes failed: " + " ".join(args[:3]))


def gfx_paths(epid):
    r = GFX / "renders"
    return {"card": r / f"{epid}_ep-card.mp4", "end": r / f"{epid}_end-card.mp4",
            "tag_hook": r / f"{epid}_tag-hook.webm", "tag_main": r / f"{epid}_tag-main.webm"}


def stage_graphics(ep, work):
    series, epc = configs(ep)
    epid = ep.name
    for d in ("renders", "vars", "assets"):
        (GFX / d).mkdir(exist_ok=True)
    plan = json.loads((work / "plan.json").read_text(encoding="utf-8"))
    # cover for the end card: custom image, else a frame near the end of the last clip
    cover_rel = f"assets/cover_{epid}.png"
    if epc.get("cover"):
        shutil.copy(epc["cover"], GFX / cover_rel)
    else:
        last = plan["segments"][-1]
        c = plan["clips"][last["clip"]]
        run([FFMPEG, "-y", "-v", "error", "-ss", f"{max(0, last['out'] - 0.45):.2f}", "-i", c["file"], "-frames:v", "1",
             "-vf", f"scale={W}:-2:flags=lanczos,crop={W}:{H}", str(GFX / cover_rel)])
    ep_label = f"EP.{epc['ep']:02d}"
    jobs = [
        ("ep-card.html", "card", "mp4", {"series": series["title"], "epLabel": ep_label, "epTitle": epc["title"], "accent": series["accent"]}),
        ("end-card.html", "end", "mp4", {"series": series["title"], "nextEp": epc["next_ep_text"], "headline": series["end_headline"],
                                         "cover": cover_rel, "accent": series["accent"]}),
        ("tag.html", "tag_hook", "webm", {"layout": "series", "line1": series["title"], "line2": ep_label, "accent": series["accent"]}),
        ("tag.html", "tag_main", "webm", {"layout": "episode", "line1": ep_label, "line2": epc["title"], "accent": series["accent"]}),
    ]
    out = gfx_paths(epid)
    for comp, name, fmt, variables in jobs:
        vf = GFX / "vars" / f"{epid}_{name}.json"
        vf.write_text(json.dumps(variables, ensure_ascii=False), encoding="utf-8")
        run_hyperframes(["render", "--composition", comp, "--format", fmt, "--variables-file", f"vars/{vf.name}",
                         "--output", f"renders/{out[name].name}", "--workers", "1", "--quiet"])
        print("rendered graphic", out[name].name, flush=True)


# ---------------------------------------------------------------- segments / timeline
def ass_time(t):
    cs = int(round(max(0.0, t) * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def make_segments(ep, plan, epc, overrides, with_graphics=True):
    gp = gfx_paths(ep.name)
    segs = []

    def clip_seg(key, t_in, t_out, part, join="cut", fade=0.0):
        c = plan["clips"][key]
        ls = [l for l in c["lines"] if l["matched"] and l["rstart"] >= t_in - 0.05 and l["rend"] <= t_out + 0.05]
        fs = min([l["rstart"] - t_in for l in ls] or [9.9])
        return {"kind": "clip", "clip": key, "file": c["file"], "in": round(t_in, 3), "out": round(t_out, 3), "part": part,
                "join": join, "fade": fade, "first_speech": fs, "lines": ls}

    hook = epc["highlights"] if with_graphics else []
    for h in hook:
        c = plan["clips"][h["clip"]]
        t_in = max(0.0, h["start"] - h.get("lead", HOOK_LEAD))
        t_out = min(c["duration"], h["end"] + h.get("tail", HOOK_TAIL))
        segs.append(clip_seg(h["clip"], t_in, t_out, "hook"))
    if hook:
        segs.append({"kind": "card", "clip": "EP_CARD", "file": str(gp["card"]), "in": 0.0, "out": round(duration_of(gp["card"]), 3),
                     "part": "card", "join": "dissolve", "fade": HOOK_FADE, "first_speech": 9.9, "lines": []})
    first_main, prev_scene = True, None
    for s in plan["segments"]:
        out_t = overrides.get("out", {}).get(s["clip"], s["out"])
        join, fade = "cut", 0.0
        if not first_main and s["scene"] != prev_scene:
            join, fade = "dissolve", SCENE_FADE
        seg = clip_seg(s["clip"], s["in"], out_t, "main", join, fade)
        seg["first_speech"] = s["first_speech"]
        segs.append(seg)
        first_main, prev_scene = False, s["scene"]
    if with_graphics:
        segs.append({"kind": "card", "clip": "END_CARD", "file": str(gp["end"]), "in": 0.0, "out": round(duration_of(gp["end"]), 3),
                     "part": "end", "join": "dissolve", "fade": END_FADE, "first_speech": 9.9, "lines": []})
    t = 0.0
    for i, s in enumerate(segs):
        if i > 0 and s["join"] == "dissolve":
            t -= s["fade"]
        s["t0"] = round(t, 3)
        t += s["out"] - s["in"]
    return segs, t


def write_ass(segs, series, epc, path):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Meena,{FONT_FAMILY},64,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,5,1,2,70,70,235,1
Style: Thana,{FONT_FAMILY},64,&H0080E0FF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,5,1,2,70,70,235,1
Style: Notif,{FONT_FAMILY},50,&H00202020,&H000000FF,&H00F2F2F2,&H00000000,-1,0,0,0,100,100,0,0,3,26,0,8,90,90,80,1

[Events]
Format: Layer, Start, End, Style, Name, Marginl, Marginr, Marginv, Effect, Text
"""
    ev, subs = [], []
    for s in segs:
        if s["kind"] != "clip":
            continue
        ls = s["lines"]
        for i, l in enumerate(ls):
            a = l["rstart"] - 0.06
            b = l["rend"] + 0.22
            if i + 1 < len(ls):
                b = min(b, ls[i + 1]["rstart"] - 0.09)
            b = max(b, a + 0.9)
            b = min(b, s["out"] - 0.02)
            if a >= s["out"] or b <= s["in"]:
                continue
            ta, tb = s["t0"] + (max(a, s["in"]) - s["in"]), s["t0"] + (b - s["in"])
            txt = l["text"].replace("…", "...")
            ev.append(f"Dialogue: 0,{ass_time(ta)},{ass_time(tb)},{l['speaker']},,0,0,0,,{txt}")
            subs.append({"start": round(ta, 3), "end": round(tb, 3), "text": txt, "seg": s["clip"], "part": s["part"]})
    for bn in epc["banners"]:
        seg = next((s for s in segs if s["clip"] == bn["clip"] and s["part"] == "main"), None)
        if seg:
            ta = seg["t0"] + bn["at"]
            body = bn["text"].replace("\n", "\\N")
            ev.append(f"Dialogue: 1,{ass_time(ta)},{ass_time(ta + bn.get('dur', 3.2))},Notif,,0,0,0,,{{\\fad(250,250)}}{body}")
    Path(path).write_text(head + "\n".join(ev) + "\n", encoding="utf-8")
    return subs


def write_srt(subs, path):
    def ts(t):
        ms = int(round(t * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    Path(path).write_text("\n".join(f"{i}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n"
                                    for i, s in enumerate(sorted(subs, key=lambda x: x['start']), 1)), encoding="utf-8")


# ---------------------------------------------------------------- ffmpeg graph
def build_graph(segs, overlays, with_video, loud=None, subs="subs.ass"):
    n_in = len(segs)
    parts = []
    for i, s in enumerate(segs):
        T = s["out"] - s["in"]
        if with_video:
            parts.append(f"[{i}:v]trim=start={s['in']}:end={s['out']},setpts=PTS-STARTPTS,scale={W}:-2:flags=lanczos,"
                         f"crop={W}:{H},fps={FPS},setsar=1,format=yuv420p[v{i}]")
        if s["kind"] == "card":
            parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{T:.3f},asetpts=PTS-STARTPTS[a{i}]")
        else:
            fin = "" if s["first_speech"] < 0.12 else ",afade=t=in:st=0:d=0.03"
            parts.append(f"[{i}:a]atrim=start={s['in']}:end={s['out']},asetpts=PTS-STARTPTS,"
                         f"aformat=sample_rates=48000:channel_layouts=stereo{fin},afade=t=out:st={T - 0.04:.3f}:d=0.04[a{i}]")
    blocks = []
    for i, s in enumerate(segs):
        if i == 0 or s["join"] == "dissolve":
            blocks.append({"ids": [], "fade": s["fade"] if i else 0.0})
        blocks[-1]["ids"].append(i)
    for k, b in enumerate(blocks):
        ids = b["ids"]
        if with_video:
            parts.append("".join(f"[v{i}]" for i in ids) + f"concat=n={len(ids)}:v=1:a=0[vb{k}]")
        parts.append("".join(f"[a{i}]" for i in ids) + f"concat=n={len(ids)}:v=0:a=1[ab{k}]")
        b["dur"] = sum(segs[i]["out"] - segs[i]["in"] for i in ids)
    cur_v, cur_a, cur_d = "vb0", "ab0", blocks[0]["dur"]
    for k in range(1, len(blocks)):
        f = blocks[k]["fade"]
        if with_video:
            parts.append(f"[{cur_v}][vb{k}]xfade=transition=fade:duration={f}:offset={cur_d - f:.3f}[vx{k}]")
            cur_v = f"vx{k}"
        parts.append(f"[{cur_a}][ab{k}]acrossfade=d={f}[ax{k}]")
        cur_a = f"ax{k}"
        cur_d += blocks[k]["dur"] - f
    total = cur_d
    if with_video:
        for j, ov in enumerate(overlays):
            idx = n_in + j
            parts.append(f"[{idx}:v]format=yuva420p,setpts=PTS-STARTPTS+{ov['at']:.3f}/TB[ov{j}]")
            parts.append(f"[{cur_v}][ov{j}]overlay=0:0:eof_action=pass:enable='between(t,{ov['at']:.3f},{ov['at'] + TAG_LEN + 0.1:.3f})'[vo{j}]")
            cur_v = f"vo{j}"
        parts.append(f"[{cur_v}]fade=t=out:st={total - FINAL_FADE:.3f}:d={FINAL_FADE},subtitles={subs}:fontsdir=fonts[vout]")
    if loud:
        ln = (f",loudnorm=I={LUFS}:TP={TP}:LRA=11:measured_I={loud['input_i']}:measured_TP={loud['input_tp']}"
              f":measured_LRA={loud['input_lra']}:measured_thresh={loud['input_thresh']}:offset={loud['target_offset']}"
              f":linear=true:print_format=summary,aresample=48000")
    else:
        ln = f",loudnorm=I={LUFS}:TP={TP}:LRA=11:print_format=json"
    parts.append(f"[{cur_a}]afade=t=out:st={total - FINAL_FADE:.3f}:d={FINAL_FADE}{ln}[aout]")
    return ";\n".join(parts), total


def stage_render(ep, work, name):
    series, epc = configs(ep)
    out_dir = ep / "edit"
    plan = json.loads((work / "plan.json").read_text(encoding="utf-8"))
    overrides = load_json(work / "overrides.json", {})
    with_gfx = all(p.exists() for p in gfx_paths(ep.name).values()) and not overrides.get("no_graphics")
    if not with_gfx:
        print("graphics not rendered yet -> main story only (run the 'graphics' stage)")
    segs, _ = make_segments(ep, plan, epc, overrides, with_gfx)

    (work / "fonts").mkdir(exist_ok=True)
    for f in FONT_FILES:
        shutil.copy(Path("C:/Windows/Fonts") / f, work / "fonts" / f)
    subs = write_ass(segs, series, epc, work / "subs.ass")
    write_srt(subs, out_dir / f"{name}.srt")

    overlays = []
    if with_gfx:
        gp = gfx_paths(ep.name)
        first_main = next(s for s in segs if s["part"] == "main")
        if any(s["part"] == "hook" for s in segs):
            overlays.append({"file": gp["tag_hook"], "at": 0.25})
        overlays.append({"file": gp["tag_main"], "at": round(first_main["t0"] + 0.4, 3)})
    seg_inputs = []
    for s in segs:
        seg_inputs += ["-i", s["file"]]
    ov_inputs = []
    for ov in overlays:
        ov_inputs += ["-c:v", "libvpx-vp9", "-i", str(ov["file"])]

    g1, _ = build_graph(segs, overlays, with_video=False)
    (work / "audio_pass1.txt").write_text(g1, encoding="utf-8")
    r = subprocess.run([FFMPEG, "-y", "-hide_banner", *seg_inputs, "-/filter_complex", "audio_pass1.txt",
                        "-map", "[aout]", "-f", "null", "-"], cwd=work, capture_output=True, text=True, encoding="utf-8")
    m = re.search(r"\{\s*\"input_i\".*?\}", r.stderr, re.S)
    if not m:
        print(r.stderr[-3000:])
        sys.exit("loudnorm pass 1 failed")
    loud = json.loads(m.group(0))
    print("pass1 loudness:", {k: loud[k] for k in ("input_i", "input_tp", "input_lra")})

    g2, total = build_graph(segs, overlays, with_video=True, loud=loud)
    (work / "graph.txt").write_text(g2, encoding="utf-8")
    out = out_dir / f"{name}.mp4"
    subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-stats", *seg_inputs, *ov_inputs,
                    "-/filter_complex", "graph.txt", "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium",
                    "-crf", str(overrides.get("crf", 16)), "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac", "-b:a", "320k",
                    "-ar", "48000", "-movflags", "+faststart", str(out)], cwd=work, check=True)
    print("rendered", out, f"{duration_of(out):.2f}s (expected {total:.2f}s)")
    (work / "timeline.json").write_text(json.dumps(
        {"segments": [{k: s[k] for k in ("clip", "part", "kind", "t0", "join", "fade")} | {"len": round(s["out"] - s["in"], 3)} for s in segs],
         "overlays": [{"file": Path(o["file"]).name, "at": o["at"]} for o in overlays], "subs": subs},
        ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    ep = Path(sys.argv[1])
    stage = sys.argv[2] if len(sys.argv) > 2 else "all"
    name = sys.argv[3] if len(sys.argv) > 3 else f"{ep.name}_v2"
    work = ep / "edit" / "work"
    work.mkdir(parents=True, exist_ok=True)
    if stage in ("transcribe", "all"):
        stage_transcribe(ep, work)
    if stage in ("plan", "all"):
        stage_plan(ep, work)
    if stage == "highlights":
        stage_highlights(ep, work)
    if stage in ("graphics", "all"):
        stage_graphics(ep, work)
    if stage in ("render", "all"):
        stage_render(ep, work, name)
