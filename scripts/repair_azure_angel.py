from pathlib import Path
from PIL import Image
import cv2
import numpy as np

FILES = {
    "azure_angel_idle_1.png": (-20, -2),
    "azure_angel_idle_2.png": (0, 0),
    "azure_angel_idle_3.png": (13, -1),
    "azure_angel_hurt_1.png": (0, 0),
    "azure_angel_hurt_2.png": (0, 0),
    "azure_angel_hurt_3.png": (0, 0),
}

INPUT_DIR = Path("tmp/azure-angel/source")
OUTPUT_DIR = Path("tmp/azure-angel/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def fill_small_holes(alpha: np.ndarray, max_area: int = 1800) -> np.ndarray:
    inv = (255 - alpha).astype(np.uint8)
    contours, hierarchy = cv2.findContours(inv, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = alpha.copy()
    if hierarchy is not None:
        hierarchy = hierarchy[0]
        for i, cnt in enumerate(contours):
            parent = hierarchy[i][3]
            if parent != -1 and cv2.contourArea(cnt) <= max_area:
                cv2.drawContours(out, [cnt], -1, 255, thickness=-1)
    return out


def clean_rgb(rgb: np.ndarray) -> np.ndarray:
    h, w, _ = rgb.shape
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    border = np.concatenate(
        [
            rgb[:12, :, :].reshape(-1, 3),
            rgb[-12:, :, :].reshape(-1, 3),
            rgb[:, :12, :].reshape(-1, 3),
            rgb[:, -12:, :].reshape(-1, 3),
        ],
        axis=0,
    )
    mean = border.mean(axis=0)
    dist = np.linalg.norm(rgb.astype(np.float32) - mean.astype(np.float32), axis=2)

    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    pad = 8
    mask[:pad, :] = cv2.GC_BGD
    mask[-pad:, :] = cv2.GC_BGD
    mask[:, :pad] = cv2.GC_BGD
    mask[:, -pad:] = cv2.GC_BGD
    mask[50 : h - 30, 20 : w - 20] = cv2.GC_PR_FGD

    sure_fg = (gray > 150) | (
        (hsv[:, :, 0] > 85)
        & (hsv[:, :, 0] < 140)
        & (hsv[:, :, 1] > 80)
        & (hsv[:, :, 2] > 120)
    )
    mask[sure_fg] = cv2.GC_FGD

    sure_bg = ((dist < 35) & (gray < 80)) | ((gray < 35) & (hsv[:, :, 1] < 150))
    mask[sure_bg] = np.where(mask[sure_bg] == cv2.GC_FGD, cv2.GC_FGD, cv2.GC_BGD)

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, None, bgd_model, fgd_model, 10, cv2.GC_INIT_WITH_MASK)

    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0).astype(np.uint8), 8)
    cleaned = np.zeros_like(alpha)
    for i in range(1, count):
        if stats[i, cv2.CC_STAT_AREA] > 20:
            cleaned[labels == i] = 255

    alpha = fill_small_holes(cleaned, max_area=1800)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.55)
    alpha[alpha < 16] = 0
    alpha[alpha > 239] = 255

    return np.dstack([rgb, alpha]).astype(np.uint8)


def shift_rgba(arr: np.ndarray, dx: int, dy: int) -> np.ndarray:
    h, w = arr.shape[:2]
    out = np.zeros_like(arr)

    src_x0 = max(0, -dx)
    src_y0 = max(0, -dy)
    dst_x0 = max(0, dx)
    dst_y0 = max(0, dy)
    width = min(w - src_x0, w - dst_x0)
    height = min(h - src_y0, h - dst_y0)

    if width > 0 and height > 0:
        out[dst_y0 : dst_y0 + height, dst_x0 : dst_x0 + width] = arr[
            src_y0 : src_y0 + height, src_x0 : src_x0 + width
        ]

    return out


for filename, (dx, dy) in FILES.items():
    src = INPUT_DIR / filename
    dst = OUTPUT_DIR / filename

    image = Image.open(src).convert("RGBA")
    rgb = np.array(image)[:, :, :3]
    out = clean_rgb(rgb)
    if dx or dy:
        out = shift_rgba(out, dx, dy)

    Image.fromarray(out, "RGBA").save(dst, optimize=True)

    alpha = out[:, :, 3]
    border = np.concatenate([alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]])
    print(
        f"{filename}: size={image.size} alpha={int(alpha.min())}-{int(alpha.max())} "
        f"border_nonzero={int((border > 0).sum())} shift=({dx},{dy})"
    )
