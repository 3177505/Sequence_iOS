#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:0}"

MODE="${1:---print}"

python3 - "$MODE" <<'PY'
import re
import subprocess
import sys

mode = sys.argv[1]


def run(cmd):
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
    except (FileNotFoundError, subprocess.CalledProcessError):
        return ""


def parse_wlr(text):
    outputs = []
    name = None
    w = h = x = y = None
    for line in text.splitlines():
        head = re.match(r"^([A-Za-z0-9-]+)\s+(.+)$", line.strip())
        if head and not line.startswith(" "):
            if name and w and h is not None and x is not None:
                outputs.append({"name": name, "w": w, "h": h, "x": x, "y": y})
            name = head.group(1)
            w = h = x = y = None
            res = re.search(r"(\d+)x(\d+)", head.group(2))
            if res:
                w, h = int(res.group(1)), int(res.group(2))
            continue
        pos = re.search(r"Position:\s*(-?\d+),(-?\d+)", line)
        if pos and name:
            x, y = int(pos.group(1)), int(pos.group(2))
        cur = re.search(r"current\s+(\d+)x(\d+)", line)
        if cur and name:
            w, h = int(cur.group(1)), int(cur.group(2))
    if name and w and h is not None and x is not None:
        outputs.append({"name": name, "w": w, "h": h, "x": x, "y": y})
    return outputs


def parse_xrandr(text):
    outputs = []
    for line in text.splitlines():
        m = re.match(
            r"^(\S+)\s+connected(?:\s+primary)?(?:\s+\d+x\d+)?\s+(\d+)x(\d+)\+(-?\d+)\+(-?\d+)",
            line,
        )
        if not m:
            m = re.match(r"^(\S+)\s+connected(?:\s+primary)?\s+(\d+)x(\d+)\+(-?\d+)\+(-?\d+)", line)
        if m:
            outputs.append(
                {
                    "name": m.group(1),
                    "w": int(m.group(2)),
                    "h": int(m.group(3)),
                    "x": int(m.group(4)),
                    "y": int(m.group(5)),
                }
            )
    return outputs


def detect():
    wlr = run(["wlr-randr"])
    if wlr.strip():
        outs = parse_wlr(wlr)
        if outs:
            return outs, "wlr-randr"
    xr = run(["xrandr", "--query"])
    if xr.strip():
        outs = parse_xrandr(xr)
        if outs:
            return outs, "xrandr"
    return [], "none"


outputs, source = detect()
outputs = [o for o in outputs if o["w"] > 0 and o["h"] > 0]
outputs.sort(key=lambda o: (o["x"], o["y"]))

if len(outputs) < 2:
    print(
        f"sequence-detect-dual-display: found {len(outputs)} output(s) via {source}; need 2 for dual HDMI.",
        file=sys.stderr,
    )
    if mode == "--export":
        sys.exit(1)
    for o in outputs:
        print(f"  {o['name']}: {o['w']}x{o['h']} at {o['x']},{o['y']}")
    sys.exit(1)

left = outputs[0]
right = outputs[1]
total_w = max(o["x"] + o["w"] for o in outputs[:2])
total_h = max(o["h"] for o in outputs[:2])

lines = [
    f"# source: {source}",
    f"# left  {left['name']}: {left['w']}x{left['h']} at {left['x']},{left['y']}",
    f"# right {right['name']}: {right['w']}x{right['h']} at {right['x']},{right['y']}",
    f"SEQUENCE_WINDOW_WIDTH={total_w}",
    f"SEQUENCE_WINDOW_HEIGHT={total_h}",
    f"SEQUENCE_MONITOR_LEFT_WIDTH={left['w']}",
    f"SEQUENCE_MONITOR_LEFT_X={left['x']}",
    f"SEQUENCE_MONITOR_RIGHT_X={right['x']}",
]

if mode == "--export":
    for line in lines:
        if line.startswith("SEQUENCE_"):
            print(line)
else:
    print("\n".join(lines))

PY
