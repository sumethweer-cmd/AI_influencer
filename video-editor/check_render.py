"""Post-render checks: loudness of the final file, join frames, subtitle frames, structure strip.
Usage: python -I check_render.py <ep_dir> [name]"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from drama_edit import FFMPEG, FFPROBE, duration_of  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
ep = Path(sys.argv[1])
name = sys.argv[2] if len(sys.argv) > 2 else f"{ep.name}_v2"
edit = ep / "edit"
work = edit / "work"
mp4 = edit / f"{name}.mp4"
chk = work / "check"
chk.mkdir(exist_ok=True)
for f in chk.glob("*.png"):
    f.unlink()
tl = json.loads((work / "timeline.json").read_text(encoding="utf-8"))
segs = tl["segments"]
total = duration_of(mp4)

r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(mp4), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
                    "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8")
loud = json.loads(re.search(r"\{\s*\"input_i\".*?\}", r.stderr, re.S).group(0))
print("FINAL loudness  I=%s LUFS  TP=%s dBTP  LRA=%s" % (loud["input_i"], loud["input_tp"], loud["input_lra"]))
info = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "stream=codec_name,width,height,r_frame_rate,sample_rate",
                       "-of", "csv=p=0", str(mp4)], capture_output=True, text=True, encoding="utf-8").stdout
print("streams:", info.strip().replace("\n", " | "), f"| duration {total:.2f}s")
print("structure:", [(s["clip"], s["part"], round(s["t0"], 2), s["len"]) for s in segs if s["part"] != "main"])


def frame(t, out, size="216:384"):
    subprocess.run([FFMPEG, "-y", "-v", "error", "-ss", f"{max(t, 0):.3f}", "-i", str(mp4), "-frames:v", "1",
                    "-vf", f"scale={size}", str(out)], check=True)


def sheet(pattern, cols, rows, out):
    subprocess.run([FFMPEG, "-y", "-v", "error", "-framerate", "1", "-i", str(chk / pattern), "-vf", f"tile={cols}x{rows}",
                    "-frames:v", "1", str(out)], check=True)


# joins: last frame before / first after each cut; dissolves sampled inside the fade
n, labels = 0, []
for i in range(1, len(segs)):
    t = segs[i]["t0"]
    if segs[i]["join"] == "dissolve":
        f = segs[i]["fade"]
        a, b = t + 0.03, t + f - 0.03
    else:
        a, b = t - 1.5 / 24, t + 0.5 / 24
    for tt in (a, b):
        n += 1
        frame(tt, chk / f"j_{n:03d}.png")
    labels.append(f"{segs[i - 1]['clip']}->{segs[i]['clip']}{' (dissolve)' if segs[i]['join'] == 'dissolve' else ''}")
sheet("j_%03d.png", 2, len(segs) - 1, edit / f"{name}_joins.png")
print("joins sheet rows:", labels)

# subtitles: middle of ~12 spread-out lines
subs = tl["subs"]
pick = subs[:: max(1, len(subs) // 12)][:12]
for k, s in enumerate(pick, 1):
    frame((s["start"] + s["end"]) / 2, chk / f"s_{k:02d}.png", "270:480")
sheet("s_%02d.png", 6, 2, edit / f"{name}_subs.png")
print("subtitle sheet:", [(s["seg"], round((s["start"] + s["end"]) / 2, 2)) for s in pick])

# structure strip: first 10 s (every 0.8 s) and the last 6 s (every 0.6 s) + tag overlay moments
times = [0.2 + 0.8 * i for i in range(12)]
for k, t in enumerate(times, 1):
    frame(t, chk / f"o_{k:02d}.png", "216:384")
sheet("o_%02d.png", 12, 1, edit / f"{name}_open.png")
end_times = [total - 6 + 0.5 * i for i in range(12)]
for k, t in enumerate(end_times, 1):
    frame(min(t, total - 0.05), chk / f"e_{k:02d}.png", "216:384")
sheet("e_%02d.png", 12, 1, edit / f"{name}_end.png")
