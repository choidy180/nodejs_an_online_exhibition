"""인트로 2~4번째 섹션 배경을 코드로 그린다 (numpy + Pillow). 1920x1200 JPEG."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1920, 1200
OUT = sys.argv[1]


# ---------- 공통 도구 ----------
def grid_noise(rng, gw, gh):
    # 가장자리가 반대편과 이어지는 격자 (이미지 안에서 노이즈가 되풀이될 때 이음매가 생기지 않게)
    return np.pad(rng.random((gh, gw)), ((0, 2), (0, 2)), mode="wrap")


def sample(grid, x, y):
    """grid 좌표(x, y 실수 배열)에서 부드러운 값 노이즈"""
    gh, gw = grid.shape
    x = np.mod(x, gw - 2)
    y = np.mod(y, gh - 2)
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = x - x0
    fy = y - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    a = grid[y0, x0]
    b = grid[y0, x0 + 1]
    c = grid[y0 + 1, x0]
    d = grid[y0 + 1, x0 + 1]
    top = a + (b - a) * fx
    bot = c + (d - c) * fx
    return top + (bot - top) * fy


def fbm(grids, x, y, octaves=5):
    v = np.zeros_like(x)
    amp = 0.5
    f = 1.0
    for i in range(octaves):
        v += amp * sample(grids[i % len(grids)], x * f + i * 7.3, y * f + i * 3.1)
        amp *= 0.5
        f *= 2.03
    return v


def coords(w=W, h=H):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x, y


def grain(arr, rng, amount=10):
    return arr + rng.normal(0, amount, arr.shape[:2])[..., None]


def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def vignette(arr, strength=0.55, cx=0.5, cy=0.5):
    x, y = coords()
    d = np.sqrt(((x / W - cx) * 1.2) ** 2 + (y / H - cy) ** 2)
    return arr * (1 - strength * np.clip(d / 0.75, 0, 1) ** 2)[..., None]


# ---------- 2. 아카이브 살롱 벽 (지난 전시회) ----------
def salon_wall(seed=7):
    rng = np.random.default_rng(seed)
    x, y = coords()
    grids = [grid_noise(rng, 64, 64) for _ in range(3)]
    plaster = fbm(grids, x / 90, y / 90, 5)
    base = np.array([46, 58, 52], np.float32)  # 짙은 녹회색 벽
    wall = base * (0.85 + 0.3 * plaster[..., None])
    img = to_img(wall)

    # 살롱식 배치 (x, y, w, h)
    frames = [
        (110, 150, 300, 380), (110, 570, 300, 220), (110, 830, 300, 200),
        (450, 120, 420, 300), (450, 460, 200, 260), (690, 460, 180, 140), (690, 640, 180, 90),
        (450, 760, 420, 230),
        (910, 90, 340, 460), (910, 590, 240, 300), (1190, 830, 220, 160),
        (1290, 110, 260, 200), (1290, 350, 300, 400),
        (1630, 130, 200, 300), (1630, 470, 200, 260), (1450, 790, 380, 220),
    ]
    palettes = [
        [(196, 120, 72), (238, 208, 160), (64, 84, 96)],
        [(30, 52, 92), (212, 180, 120), (230, 230, 220)],
        [(150, 40, 40), (232, 196, 120), (40, 30, 28)],
        [(92, 120, 84), (210, 200, 170), (40, 60, 50)],
        [(220, 160, 60), (60, 90, 140), (240, 232, 214)],
        [(120, 70, 110), (230, 190, 170), (50, 40, 60)],
    ]
    shadow = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(shadow)
    for (fx, fy, fw, fh) in frames:
        sd.rectangle([fx + 14, fy + 22, fx + fw + 14, fy + fh + 26], fill=170)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    arr = np.asarray(img).astype(np.float32) * (1 - np.asarray(shadow, np.float32)[..., None] / 255 * 0.75)
    img = to_img(arr)
    draw = ImageDraw.Draw(img)

    for i, (fx, fy, fw, fh) in enumerate(frames):
        kind = i % 3
        frame_col = [(150, 118, 62), (24, 22, 20), (96, 64, 40)][kind]
        border = 14 if kind != 1 else 9
        draw.rectangle([fx, fy, fx + fw, fy + fh], fill=frame_col)
        hi = tuple(min(255, c + 40) for c in frame_col)
        draw.rectangle([fx + 2, fy + 2, fx + fw - 2, fy + fh - 2], outline=hi, width=2)
        mat = 0 if kind == 1 else 18
        if mat:
            draw.rectangle([fx + border, fy + border, fx + fw - border, fy + fh - border], fill=(226, 220, 204))
        ax0, ay0 = fx + border + mat, fy + border + mat
        ax1, ay1 = fx + fw - border - mat, fy + fh - border - mat
        aw, ah = ax1 - ax0, ay1 - ay0
        pal = [np.array(c, np.float32) for c in palettes[rng.integers(len(palettes))]]
        ax, ay = coords(aw, ah)
        g2 = [grid_noise(rng, 32, 32) for _ in range(2)]
        n = fbm(g2, ax / 40, ay / 40, 4)
        art = np.zeros((ah, aw, 3), np.float32)
        style = int(rng.integers(4))
        if style == 0:  # 노을 풍경
            t = (ay / ah)[..., None]
            art[:] = pal[1] * (1 - t) + pal[0] * t
            hill = (ay / ah) > (0.62 + 0.24 * (n - 0.5))
            art[hill] = pal[2] * (0.8 + 0.4 * n[hill][:, None])
        elif style == 1:  # 색면 회화
            art[:] = pal[2]
            for k, (top, bot) in enumerate([(0.08, 0.46), (0.54, 0.92)]):
                dy = np.abs((ay / ah) - (top + bot) / 2) / ((bot - top) / 2)
                dx = np.abs(ax / aw - 0.5) / 0.42
                m = np.clip(1 - np.maximum(dy, dx) ** 6, 0, 1)[..., None]
                art = art * (1 - m) + pal[k] * (0.9 + 0.2 * n[..., None]) * m
        elif style == 2:  # 초상
            art[:] = pal[2] * (0.7 + 0.5 * n[..., None])
            d = ((ax / aw - 0.5) / 0.24) ** 2 + ((ay / ah - 0.42) / 0.3) ** 2
            m = (np.clip(1.2 - d, 0, 1) ** 0.6)[..., None]
            art = art * (1 - m) + pal[1] * (0.85 + 0.2 * n[..., None]) * m
            body = ((ax / aw - 0.5) / 0.42) ** 2 + ((ay / ah - 1.05) / 0.38) ** 2 < 1
            art[body] = pal[0] * 0.8
        else:  # 추상 원
            art[:] = pal[1] * (0.85 + 0.25 * n[..., None])
            for k in range(3):
                cx, cy = rng.random() * aw, rng.random() * ah
                r = (0.15 + rng.random() * 0.3) * min(aw, ah)
                m = np.clip((r - np.sqrt((ax - cx) ** 2 + (ay - cy) ** 2)) / 3, 0, 1)[..., None]
                art = art * (1 - m * 0.9) + pal[k % 3] * m * 0.9
        img.paste(to_img(grain(art, rng, 6)), (ax0, ay0))

    arr = np.asarray(img).astype(np.float32)
    light = np.full((H, W), 0.42, np.float32)
    for sx in [260, 660, 1080, 1440, 1730]:
        light += 0.75 * np.exp(-(((x - sx) / 330) ** 2 + ((y - 280) / 520) ** 2))
    arr = arr * light[..., None]
    arr = vignette(arr, 0.5)
    return to_img(grain(arr, rng, 7))


# ---------- 3. 빈 갤러리 (나만의 전시회) ----------
def empty_gallery(seed=11):
    rng = np.random.default_rng(seed)
    x, y = coords()
    grids = [grid_noise(rng, 96, 96) for _ in range(3)]
    n = fbm(grids, x / 60, y / 60, 5)
    bx0, bx1, by0, by1 = 520, 1400, 150, 790  # 뒷벽
    wall = np.array([214, 210, 202], np.float32)
    floor = np.array([78, 76, 74], np.float32)
    ceil = np.array([52, 52, 54], np.float32)
    is_back = (x >= bx0) & (x <= bx1) & (y >= by0) & (y <= by1)
    fl_t = np.clip((y - by1) / (H - by1), 0, 1)
    is_floor = (y > by1) & (x >= bx0 - bx0 * fl_t) & (x <= bx1 + (W - bx1) * fl_t)
    ce_t = np.clip((by0 - y) / by0, 0, 1)
    is_ceil = (y < by0) & (x >= bx0 - bx0 * ce_t) & (x <= bx1 + (W - bx1) * ce_t)
    is_side = ~(is_back | is_floor | is_ceil)
    depth_side = np.clip(np.where(x < bx0, (bx0 - x) / bx0, (x - bx1) / (W - bx1)), 0, 1)
    arr = np.zeros((H, W, 3), np.float32)
    arr[is_back] = wall
    arr[is_side] = (wall * (0.82 - 0.25 * depth_side)[..., None])[is_side]
    arr[is_floor] = (floor * (0.7 + 0.5 * n[..., None]) * (1.15 - 0.45 * fl_t[..., None]))[is_floor]
    arr[is_ceil] = (ceil * (1.0 - 0.3 * ce_t[..., None]))[is_ceil]
    arr *= (0.92 + 0.12 * n[..., None])
    img = to_img(arr)
    d = ImageDraw.Draw(img)
    d.line([(bx0, by1), (bx1, by1)], fill=(150, 146, 140), width=3)
    d.line([(bx0, by0), (0, 0)], fill=(70, 70, 72), width=2)
    d.line([(bx1, by0), (W, 0)], fill=(70, 70, 72), width=2)
    d.line([(bx0, by1), (0, H)], fill=(110, 108, 104), width=2)
    d.line([(bx1, by1), (W, H)], fill=(110, 108, 104), width=2)
    d.line([(bx0, by0), (bx0, by1)], fill=(170, 166, 160), width=2)
    d.line([(bx1, by0), (bx1, by1)], fill=(170, 166, 160), width=2)
    # 빈 캔버스 + 그림자
    cx0, cy0, cx1, cy1 = 800, 300, 1120, 620
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).rectangle([cx0 + 10, cy0 + 16, cx1 + 10, cy1 + 22], fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    arr = np.asarray(img).astype(np.float32) * (1 - np.asarray(sh, np.float32)[..., None] / 255 * 0.5)
    img = to_img(arr)
    d = ImageDraw.Draw(img)
    d.rectangle([cx0, cy0, cx1, cy1], fill=(232, 229, 222))
    d.rectangle([cx1 - 6, cy0, cx1, cy1], fill=(222, 220, 214))
    arr = np.asarray(img).astype(np.float32)
    # 조명: 방은 어둡게, 캔버스 스포트라이트 + 바닥에 떨어진 빛
    light = np.full((H, W), 0.34, np.float32)
    light += 0.62 * np.exp(-(((x - 960) / 300) ** 2 + ((y - 470) / 260) ** 2))
    light += 0.45 * np.exp(-(((x - 960) / 420) ** 2 + ((y - 900) / 120) ** 2)) * is_floor
    arr = arr * light[..., None]
    # 천장에서 내려오는 빛줄기
    beam = Image.new("L", (W, H), 0)
    ImageDraw.Draw(beam).polygon([(930, 0), (990, 0), (1170, 640), (750, 640)], fill=48)
    beam = beam.filter(ImageFilter.GaussianBlur(40))
    b = np.asarray(beam, np.float32)[..., None] / 255
    arr = arr + b * np.array([255, 246, 228], np.float32) * (1 - (y / 900)[..., None] * 0.6)
    # 바닥에 비친 캔버스
    refl = np.zeros((H, W), np.float32)
    ry0 = by1 + 6
    ry1 = ry0 + int((cy1 - cy0) * 0.35)
    refl[ry0:ry1, cx0:cx1] = np.linspace(0.18, 0, ry1 - ry0)[:, None]
    refl_img = Image.fromarray((refl * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8))
    arr = arr + np.asarray(refl_img, np.float32)[..., None] / 255 * 230
    # 빛줄기 속 먼지
    for _ in range(160):
        py = rng.random() * 620
        px = 960 + rng.normal(0, 60 + py * 0.2)
        if abs(px - 960) > 40 + py * 0.33:
            continue
        xs, ys = int(px), int(py)
        arr[max(0, ys - 1):ys + 2, max(0, xs - 1):xs + 2] += 40 + rng.random() * 60
    arr = vignette(arr, 0.45)
    return to_img(grain(arr, rng, 6)).filter(ImageFilter.GaussianBlur(0.6))


# ---------- 4. 유체 추상화 (누구나 즐기는 전시) ----------
def fluid_art(seed=23):
    rng = np.random.default_rng(seed)
    x, y = coords()
    grids = [grid_noise(rng, 64, 64) for _ in range(4)]
    px, py = x / 520, y / 520
    qx = fbm(grids, px, py, 5)
    qy = fbm(grids, px + 5.2, py + 1.3, 5)
    rx = fbm(grids, px + 4 * qx + 1.7, py + 4 * qy + 9.2, 5)
    ry = fbm(grids, px + 4 * qx + 8.3, py + 4 * qy + 2.8, 5)
    f = fbm(grids, px + 4 * rx, py + 4 * ry, 5)
    f = (f - f.min()) / (f.max() - f.min())
    pal = np.array([[18, 22, 58], [196, 30, 52], [242, 150, 60], [250, 226, 200], [40, 110, 170]], np.float32)
    t = f * (len(pal) - 1)
    i0 = np.clip(np.floor(t).astype(int), 0, len(pal) - 2)
    ft = (t - i0)[..., None]
    ft = ft * ft * (3 - 2 * ft)
    col = pal[i0] * (1 - ft) + pal[i0 + 1] * ft
    mixq = np.clip((qx - 0.3) * 2.2, 0, 1)[..., None]
    col = col * (1 - 0.35 * mixq) + np.array([120, 40, 120], np.float32) * 0.35 * mixq
    mixr = np.clip((ry - 0.45) * 3, 0, 1)[..., None]
    col = col * (1 - 0.25 * mixr) + np.array([250, 240, 230], np.float32) * 0.25 * mixr
    g2 = grid_noise(rng, 256, 256)
    stroke = sample(g2, x / 3.0 + ry * 160, y / 40.0)
    col = col * (0.9 + 0.2 * stroke[..., None])
    col = vignette(col, 0.35)
    return to_img(grain(col, rng, 5))


salon_wall().save(OUT + "/intro_archive.jpg", quality=88)
empty_gallery().save(OUT + "/intro_gallery.jpg", quality=88)
fluid_art().save(OUT + "/intro_fluid.jpg", quality=88)
print("ok")
