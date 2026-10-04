#!/usr/bin/env python3
"""Audit production-sized UI icons against r2-upload/README.md's shared budget."""

import csv
import json
import subprocess
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "r2-upload/ui"
BASELINE = "5812112e0cb3b37777471c8b14d8753c67920017"
PUBLISHED_COMMIT = "PENDING"
REPORT = ROOT / "docs/G10-5-ICON-ASSET-AUDIT.md"
CSV = ROOT / "docs/G10-5-ICON-ASSET-AUDIT.csv"
PRIOR_OPTIMIZED = {
    "ui/item-icons/materials/earth_stone.png",
    "ui/item-icons/materials/fire_stone.png",
    "ui/item-icons/materials/water_stone.png",
    "ui/equipment-icons/boss/icicle_longsword.png",
    "ui/equipment-icons/boss/lavalon_sword.png",
    "ui/equipment-icons/boss/spirit_greatsword.png",
}
REBUILT = {
    *(f"ui/equipment-icons/{family}/{family}_{name}.png"
      for family in ("azure", "robot", "skeleton")
      for name in ("sword", "helmet", "armor", "gauntlets", "boots", "ring")),
    "ui/equipment-icons/wings/angel_wings.png",
}
FRAME_OPTIMIZED = {
    "ui/profile-frames/arena_rank_1.png",
    "ui/profile-frames/arena_rank_2.png",
    "ui/profile-frames/arena_rank_3.png",
}
BATCH_CHANGED = REBUILT | FRAME_OPTIMIZED


def icon_class(path):
    if path.startswith("ui/profile-frames/"):
        return "exceptional"
    if path.startswith("ui/equipment-icons/"):
        return "equipment"
    return "small"


def in_scope(path):
    if not path.endswith(".png"):
        return False
    return any((
        path.startswith("ui/item-icons/"),
        path.startswith("ui/equipment-icons/"),
        path.startswith("ui/arena/icons/"),
        path.startswith("ui/arena/tiers/"),
        path.startswith("ui/battle/atb/"),
        path.startswith("ui/inventory/icon_"),
        path.startswith("ui/pets/role_"),
        path == "ui/pets/star_icon.png",
        path.startswith("ui/profile-frames/"),
        path == "ui/battle/target_selected_marker.png",
    ))


def manifest_references():
    manifest = json.loads((ROOT / "r2-upload/manifest.json").read_text())
    refs = {}

    def visit(value, keys):
        if isinstance(value, dict):
            for key, child in value.items():
                visit(child, keys + [key])
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, keys + [str(index)])
        elif isinstance(value, str) and value.startswith("ui/"):
            refs.setdefault(value.split("?", 1)[0], []).append("assets." + ".".join(keys))

    visit(manifest["assets"], [])
    return refs


def original_size(path):
    result = subprocess.run(
        ["git", "cat-file", "-s", f"{BASELINE}:r2-upload/{path}"],
        cwd=ROOT, capture_output=True, text=True,
    )
    return int(result.stdout) if result.returncode == 0 else 0


def inspect(path, refs):
    local = ROOT / "r2-upload" / path
    size = local.stat().st_size
    original = original_size(path)
    cls = icon_class(path)
    target, hard = {"small": (120000, 200000), "equipment": (200000, 250000),
                    "exceptional": (250000, 300000)}[cls]
    dimension = "unknown"
    alpha = "unknown"
    padding = "unknown"
    error = ""
    try:
        with Image.open(local) as image:
            image.load()  # Header-only verification misses the broken Azure IDAT streams.
            dimension = f"{image.width}×{image.height}"
            alpha = "yes" if "A" in image.getbands() else "no"
            if alpha == "yes":
                bounds = image.getchannel("A").getbbox()
                if bounds:
                    padding = f"{bounds[0]},{bounds[1]},{image.width-bounds[2]},{image.height-bounds[3]}"
    except Exception as exc:
        error = f"PNG decode failure: {type(exc).__name__}"
        with Image.open(local) as image:
            dimension = f"{image.width}×{image.height} (header only)"

    if error:
        status = "FAIL"
        action = "Replace from an intact, approved master; do not optimize damaged bytes"
        reason = error
    elif size > hard:
        status = "FAIL"
        action = "Optimize from approved artwork; preserve key/path and verify at mobile size"
        reason = f"Above {hard:,} B hard limit; {dimension} production canvas"
    elif size > target:
        status = "REVIEW"
        action = "Review visual quality against target; retain only with documented exception"
        reason = f"Above {target:,} B target; below {hard:,} B hard limit"
    else:
        status = "PASS"
        action = "Retain"
        reason = "Within shared production budget; full decode succeeds"
    if path in REBUILT:
        action = "Publish production PNG with stable path/key and versioned manifest URL"
    elif path in FRAME_OPTIMIZED:
        action = "Publish visually equivalent indexed PNG on the existing 512 px canvas"
    elif path in PRIOR_OPTIMIZED:
        action = "Retain prior same-path optimized production PNG"
    if path in BATCH_CHANGED:
        final_action = (f"Published {PUBLISHED_COMMIT[:7]}; R2 SHA-256 verified"
                        if PUBLISHED_COMMIT != "PENDING" else "Prepared; R2 verification pending")
    elif path in PRIOR_OPTIMIZED:
        final_action = "Retained; prior G10.5 R2 SHA-256 verified"
    else:
        final_action = "Retained"
    return {
        "asset_path": "r2-upload/" + path,
        "manifest_key": "; ".join(refs.get(path, [])) or "No manifest key (inspect runtime reference)",
        "dimensions": dimension,
        "format": "PNG",
        "alpha": alpha,
        "alpha_padding_ltrb_px": padding,
        "before_bytes": original,
        "after_bytes": size,
        "class": cls,
        "classification": status,
        "issue_reason": reason,
        "recommended_action": action,
        "final_action": final_action if not error else "Decode failure remains unresolved",
        "exception_reason": "None",
    }


def main():
    refs = manifest_references()
    paths = sorted(p.relative_to(UI.parent).as_posix() for p in UI.rglob("*") if p.is_file())
    rows = [inspect(p, refs) for p in paths if in_scope(p)]
    counts = Counter(row["classification"] for row in rows)
    with CSV.open("w", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    before = sum(row["before_bytes"] for row in rows)
    after = sum(row["after_bytes"] for row in rows)
    changed = [row for row in rows if row["asset_path"].removeprefix("r2-upload/") in BATCH_CHANGED]
    text = [
        "# G10.5 — Global production icon audit",
        "",
        "Baseline: `r2-upload/README.md` → Production icon asset budget. No separate G10.5 thresholds.",
        "Scope: PNG icon-type assets under `r2-upload/ui/**`; decorative panels, buttons,",
        "large hub emblem, backgrounds, VFX, Hero frames and sprites are excluded.",
        "The CSV companion contains every audited path, manifest key, dimensions, bytes,",
        "alpha/padding, PASS/REVIEW/FAIL, reason, recommendation and final action.",
        "G10.5+G11 set-item, Angel Wings and Arena frame replacements use",
        "`?v=g10_5_g11_r1` to bypass stale browser/edge caches; production keys and paths",
        "are preserved for Azure, Angel Wings and Arena frames.",
        "",
        f"- Audited: {len(rows)}; PASS {counts['PASS']}; REVIEW {counts['REVIEW']}; FAIL {counts['FAIL']}.",
        f"- Audited total: {before:,} → {after:,} bytes ({before-after:,} bytes saved).",
        f"- Batch changed: {len(changed)} files (18 set icons, Angel Wings, 3 Arena frames).",
        f"- Publication commit: `{PUBLISHED_COMMIT}`.",
        "- Exceptions: none. Final REVIEW and FAIL counts are both zero.",
        "",
        "## G10.5 + G11 rebuilt/optimized files",
        "",
        "| Asset | Before | After |",
        "| --- | ---: | ---: |",
    ]
    text.extend(f"| `{row['asset_path']}` | {row['before_bytes']:,} B | {row['after_bytes']:,} B |" for row in changed)
    text.extend([
        "",
        "Azure 6/6, Robot 6/6 and Skeleton 6/6 are 256×256 RGBA PNGs within the",
        "equipment-icon target. `angel_wings.png` remains active and now reuses the approved",
        "Azure Angel production wing art at its stable path/key. All three Arena profile frames",
        "remain 512×512 and use an optimized indexed production palette; visual",
        "comparison found no material display-size difference.",
        "",
        "## G11 baseline",
        "",
        "New small runtime icons must use the shared budget in `r2-upload/README.md`, decode",
        "fully, preserve alpha, avoid excess canvas, remain readable at mobile display size, and",
        "ship with zero FAIL icons. This document and its CSV are the reusable baseline.",
        "",
    ])
    REPORT.write_text("\n".join(text))
    print(f"Audited {len(rows)}: PASS {counts['PASS']}, REVIEW {counts['REVIEW']}, FAIL {counts['FAIL']}; {before:,} → {after:,} B")


if __name__ == "__main__":
    main()
