# Rebranding (17/10/2026): sobre la foto de referencia de la anilla de la casa se borran «ARNALDO» y la firma
# «Arnaldo» de la laca negra y se escriben «ARNALDO VALLÉS» (Cinzel, oro) y la firma «Arnaldo Vallés»
# (Pinyon Script, provisional) con la misma inclinación, curvatura y luz. El resto de la foto no se toca.
import sys, os, math, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
src, dst = sys.argv[1:3]
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.array(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
# 1) interior de laca negra: elipse ajustada al borde interior del marco (puntos medidos sobre la foto)
P = np.float32([[442, 360], [435, 420], [450, 470], [480, 510], [530, 540], [600, 550], [670, 530], [720, 490], [750, 440],
                [758, 380], [740, 320], [690, 290], [630, 288], [560, 305], [490, 330]])
el = cv2.fitEllipse(P)
(ecx, ecy), (ew, eh), eang = el
inter = np.zeros((H, W), np.uint8)
cv2.ellipse(inter, ((ecx, ecy), (ew - 22, eh - 22), eang), 1, -1)
gold = (inter > 0) & (r > 70) & (r > b + 20)
halo = (inter > 0) & (r > 38) & (r > b + 10)            # bordes en sombra de las letras
mask = cv2.dilate((gold | halo).astype(np.uint8), np.ones((11, 11), np.uint8)) & inter
clean = cv2.inpaint(np.clip(im, 0, 255).astype(np.uint8), mask, 11, cv2.INPAINT_TELEA).astype(np.float32)
# grano fino de la laca sobre lo rellenado (ruido suave, sin copiar zonas con letras)
rng = np.random.default_rng(7)
clean = clean + np.where(mask[..., None] > 0, cv2.GaussianBlur(rng.normal(0, 2.2, (H, W)).astype(np.float32), (0, 0), .7)[..., None], 0)
# 2) orientación del texto original: eje principal de las letras de oro
ys, xs = np.nonzero(gold)
pts = np.column_stack([xs, ys]).astype(np.float64)
m = pts.mean(0)
_, _, vt = np.linalg.svd(pts - m, full_matrices=False)
d = vt[0] if vt[0][0] > 0 else -vt[0]
ang = math.degrees(math.atan2(d[1], d[0]))           # negativo: el texto sube hacia la derecha
nrm = np.array([-d[1], d[0]])
proj = (pts - m) @ nrm
def axis(q):
    mq = q.mean(0); _, _, v = np.linalg.svd(q - mq, full_matrices=False)
    dv = v[0] if v[0][0] > 0 else -v[0]
    return mq, math.degrees(math.atan2(dv[1], dv[0]))
caps_c, ang_c = axis(pts[proj < 0])                 # «ARNALDO» (arriba)
scr_c, ang_s = axis(pts[proj > 25])                 # firma (abajo)
q = pts[proj < 0]; dc = np.array([math.cos(math.radians(ang_c)), math.sin(math.radians(ang_c))])
along = (q - caps_c) @ dc; caps_w = np.percentile(along, 99.5) - np.percentile(along, .5)
print("caps", caps_c, round(ang_c, 1), "ancho", round(caps_w), "firma", scr_c, round(ang_s, 1))
caps_h = np.percentile(proj[proj < 0], 98) - np.percentile(proj[proj < 0], 2)
col = np.median(im[gold & (proj.min() < 0)].reshape(-1, 3), axis=0) if False else np.median(im[gold], axis=0)
hi = np.percentile(im[gold], 90, axis=0)


def render(text, font, size, tracking=0, stroke=0):
    f = ImageFont.truetype(os.path.join(B, "fonts", font), size)
    tmp = Image.new("L", (10, 10)); dd = ImageDraw.Draw(tmp)
    wsum = sum(dd.textlength(c, font=f) for c in text) + tracking * (len(text) - 1)
    can = Image.new("L", (int(wsum) + 80, int(size * 2.1)), 0)
    d2 = ImageDraw.Draw(can)
    x = 40
    for c in text:
        d2.text((x, int(size * .35)), c, font=f, fill=255, stroke_width=stroke, stroke_fill=255)
        x += d2.textlength(c, font=f) + tracking
    return np.array(can).astype(np.float32) / 255.0


def place(alpha, center, width, angle_deg, bend=0.0):
    """Coloca el lienzo centrado en `center`, con anchura `width` px, girado y con ligera curvatura (arco)."""
    ah, aw = alpha.shape
    sc = width / aw
    a = cv2.resize(alpha, (int(aw * sc), int(ah * sc)), interpolation=cv2.INTER_AREA)
    if bend:
        hh, ww = a.shape
        xs_ = np.arange(ww, dtype=np.float32)
        off = bend * ((xs_ - ww / 2) / (ww / 2)) ** 2
        mx, my = np.meshgrid(xs_, np.arange(hh, dtype=np.float32))
        a = cv2.remap(a, mx, my - off[None, :].astype(np.float32), cv2.INTER_LINEAR)
    hh, ww = a.shape
    M = cv2.getRotationMatrix2D((ww / 2, hh / 2), -angle_deg, 1.0)
    M[0, 2] += center[0] - ww / 2
    M[1, 2] += center[1] - hh / 2
    return cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_CUBIC)


caps = render("ARNALDO VALLÉS", "cinzel-latin-700-normal.woff2", 140, tracking=10)
scr = render("Arnaldo Vallés", "pinyon-script-latin-400-normal.woff2", 150, stroke=2)
# rúbrica bajo la firma
sh, sw = scr.shape
ru = Image.fromarray((scr * 255).astype(np.uint8)); dr = ImageDraw.Draw(ru)
cols = np.nonzero(scr.max(0) > .5)[0]; rows = np.nonzero(scr.max(1) > .5)[0]
base = rows[0] + int((rows[-1] - rows[0]) * .78)       # bajo la línea de base, sobre los rasgos descendentes
dr.line([(cols[0] + 70, base + 26), (cols[-1] - 30, base + 6)], fill=255, width=6)
scr = np.array(ru).astype(np.float32) / 255.0
a1 = place(caps, caps_c + nrm * 7 - dc * 9, caps_w * 1.12, ang_c, bend=8)
a2 = place(scr, scr_c + nrm * 8, 235, ang_s)
a = np.clip(a1 + a2, 0, 1) * (inter > 0)
a = cv2.GaussianBlur(a, (0, 0), 0.6)
# oro con la luz de la foto: degradado a lo largo de la normal (como el foil original) + sombra de relieve
yy, xx = np.mgrid[0:H, 0:W]
t = ((xx - m[0]) * nrm[0] + (yy - m[1]) * nrm[1])
shade = np.clip(1.08 - 0.0025 * t, 0.75, 1.15)[..., None]
goldc = np.clip(hi[None, None, :] * shade, 0, 255)
bev = (a - np.roll(np.roll(a, 1, 0), 1, 1))[..., None]      # bisel: luz arriba-izquierda
goldc = np.clip(goldc * (1 + 0.35 * bev) * (0.9 + 0.1 * cv2.GaussianBlur(a, (0, 0), 2)[..., None]), 0, 255)
shadow = np.roll(np.roll(a, 2, 0), 1, 1)[..., None]
out = clean * (1 - 0.55 * shadow)
out = out * (1 - a[..., None]) + goldc * a[..., None]
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, optimize=True)
print("ángulo", round(ang, 1), "elipse", [round(v, 1) for v in (ecx, ecy, ew, eh, eang)])
