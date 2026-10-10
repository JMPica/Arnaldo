import sys, numpy as np, cv2
from PIL import Image
src, dst, dbg = sys.argv[1:4]
im = np.array(Image.open(src).convert("RGB")).astype(float)
H, W, _ = im.shape
R, G, B = im[..., 0], im[..., 1], im[..., 2]
lum = im.mean(2)
gold = ((R - B > 30) & (R > 70)) | ((lum > 150) & (R - B > 18))
gold = gold.astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(gold, 8)
# guion espurio de «Nº- 3»: componentes oro dentro de la caja del guion
dash = np.zeros_like(gold)
for i in range(1, n):
    x, y, w, h, a = st[i]
    if 745 <= x and x + w <= 790 and 680 <= y and y + h <= 710:
        dash[lab == i] = 1
gold_k = cv2.dilate(gold * (1 - dash), np.ones((5, 5), np.uint8))
X0, X1 = 372, 1076
box = np.zeros((H, W), np.uint8)
box[240:416, X0:X1] = 1
box[655:836, X0:X1] = 1
fill = (box & (1 - gold_k)) | cv2.dilate(dash, np.ones((7, 7), np.uint8))
# perfil por columna de la laca lisa (zona del nombre, sin oro)
ref_rows = slice(455, 640)
prof = np.zeros((W, 3))
for x in range(X0, X1):
    col = im[ref_rows, x]
    ok = gold_k[ref_rows, x] == 0
    prof[x] = np.median(col[ok], axis=0) if ok.sum() > 10 else 0
prof = cv2.GaussianBlur(prof[None], (0, 0), sigmaX=3)[0]
synth = np.repeat(prof[None], H, axis=0)
rng = np.random.default_rng(7)
synth += rng.normal(0, 1.2, synth.shape)
alpha = cv2.GaussianBlur(fill.astype(float), (0, 0), 1.5)[..., None]
out = im * (1 - alpha) + synth * alpha
res = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(res).save(dst, optimize=True)
Image.fromarray(res).crop((360, 220, 1100, 860)).save(dbg)
