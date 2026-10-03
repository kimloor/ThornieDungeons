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
BASELINE = "aef8a1af548310770cfc9ad3d4acdedd012a8061"
PUBLISHED_COMMIT = "33510ed345af2ef0b6d64fa3b34bf4f9f2061d40"
REPORT = ROOT / "docs/G10-5-ICON-ASSET-AUDIT.md"
CSV = ROOT / "docs/G10-5-ICON-ASSET-AUDIT.csv"
OPTIMIZED = {
    "ui/item-icons/materials/earth_stone.png",
    "ui/item-icons/materials/fire_stone.png",
    "ui/item-icons/materials/water_stone.png",
    "ui/equipment-icons/boss/icicle_longsword.png",
    "ui/equipment-icons/boss/lavalon_sword.png",
    "ui/equipment-icons/boss/spirit_greatsword.png",
}


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
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    return int(result.stdout)


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
    if path in OPTIMIZED:
        action = "Maintain same-path production PNG and versioned manifest URL" if size != original else "Optimization planned"
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
        "final_action": f"Published {PUBLISHED_COMMIT[:7]}; R2 SHA-256 verified" if path in OPTIMIZED and size != original else "Retained; replacement blocked pending intact master" if error else "Retained",
        "exception_reason": "None; review only" if status == "REVIEW" else "None",
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
    invalid = [row for row in rows if "decode failure" in row["issue_reason"]]
    review = [row for row in rows if row["classification"] == "REVIEW"]
    optimized = [row for row in rows if row["before_bytes"] != row["after_bytes"]]
    text = [
        "# G10.5 — Global production icon audit",
        "",
        "Baseline: `r2-upload/README.md` → Production icon asset budget. No separate G10.5 thresholds.",
        "Scope: PNG icon-type assets under `r2-upload/ui/**`; decorative panels, buttons,",
        "large hub emblem, backgrounds, VFX, Hero frames and sprites are excluded.",
        "The CSV companion contains every audited path, manifest key, dimensions, bytes,",
        "alpha/padding, PASS/REVIEW/FAIL, reason, recommendation and final action.",
        "The six optimized keys use a `?v=g10_5_r1` manifest URL revision to bypass",
        "the R2 Worker's one-day browser cache; underlying keys and paths remain unchanged.",
        "",
        f"- Audited: {len(rows)}; PASS {counts['PASS']}; REVIEW {counts['REVIEW']}; FAIL {counts['FAIL']}.",
        f"- Audited total: {before:,} → {after:,} bytes ({before-after:,} bytes saved).",
        f"- Optimized candidates: {len(optimized)}; same PNG path and manifest key.",
        f"- Published in `{PUBLISHED_COMMIT}`; R2 upload workflow downloaded and SHA-256 verified all six.",
        "- Production direct image URLs decoded at expected 256/512 px; authenticated mobile",
        "  gameplay surfaces remain unverified and are not claimed as PASS.",
        "",
        "## Optimization candidates",
        "",
        "| Asset | Before | After |",
        "| --- | ---: | ---: |",
    ]
    text.extend(f"| `{row['asset_path']}` | {row['before_bytes']:,} B | {row['after_bytes']:,} B |" for row in optimized)
    text.extend(["", "## Unresolved damaged source assets — publication blocker", ""])
    text.extend(f"- `{row['asset_path']}` — {row['issue_reason']}; {row['after_bytes']:,} B, {row['dimensions']}." for row in invalid)
    text.extend([
        "",
        "These files were already invalid in the audited `main` baseline, not damaged by this batch.",
        "All six Azure set-item PNGs and legacy `angel_wings.png` must be recovered from",
        "intact approved masters, visually matched, then optimized before G10.5 can close.",
        "Do not treat corruption as a size-only exception or recreate approved artwork by guesswork.",
        "",
        "## Review-only assets and exceptions",
        "",
    ])
    text.extend(f"- `{row['asset_path']}` — {row['after_bytes']:,} B, {row['issue_reason']}." for row in review)
    text.extend([
        "",
        "No oversized icon is silently grandfathered. REVIEW is pending visual/usage sign-off,",
        "not an approved exception. There is no approved >500 KB exception.",
        "",
        "## QA and publication gate",
        "",
        "- Full PNG decode, alpha bounds, manifest mapping and at-size readability must pass.",
        "- Verify actual Inventory, equipment/Compare, Shop, Craft, Reward, Arena, Raid and Battle",
        "  mobile surfaces after publication; explicitly retest Azure and Earth/Fire/Water Stone.",
        "- Download every replaced R2 object and compare SHA-256 with committed production PNG.",
        "- Check 404/missing images, fallback behavior and mobile loading. Do not claim complete",
        "  while Azure source recovery or production QA remains open.",
        "- G11 Robot/Skeleton item icons must comply with this same shared budget and have zero",
        "  FAIL icons before publication.",
        "",
    ])
    REPORT.write_text("\n".join(text))
    print(f"Audited {len(rows)}: PASS {counts['PASS']}, REVIEW {counts['REVIEW']}, FAIL {counts['FAIL']}; {before:,} → {after:,} B")


if __name__ == "__main__":
    main()
