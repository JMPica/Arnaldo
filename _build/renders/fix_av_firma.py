# Retoque de arnaldo-av-1 (s2): el render escribe bien «ARNALDO VALLÉS» pero la firma dice «Arnado Vallés».
# Se borra la firma (y su subrayado) sobre la laca negra y se escribe «Arnaldo Vallés» en caligrafía provisional
# (Pinyon Script, OFL 1.1) con la misma inclinación, tamaño y oro de la foto. Las mayúsculas no se tocan.
import sys, os, math, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
src, dst = sys.argv[1:3]
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.array(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
yy, xx = np.mgrid[0:H, 0:W]
# zona de la firma: bajo la línea inferior de las mayúsculas, dentro de la laca (coordenadas medidas en la foto)
caps_bottom = 450 + (140 + (xx - 540) * 2 * 0.205) / 2          # recta bajo «ARNALDO VALLÉS»
region = (xx > 572) & (xx < 770) & (yy > caps_bottom + 9) & (yy < 624)
gold = region & (r > 70) & (r > b + 25)
mask = cv2.dilate(gold.astype(np.uint8), np.ones((7, 7), np.uint8)) & region.astype(np.uint8)
clean = cv2.inpaint(np.clip(im, 0, 255).astype(np.uint8), mask, 9, cv2.INPAINT_TELEA).astype(np.float32)
# geometría de la firma original: eje principal de sus píxeles de oro
ys, xs = np.nonzero(gold)
pts = np.column_stack([xs, ys]).astype(np.float64)
m = pts.mean(0)
_, _, vt = np.linalg.svd(pts - m, full_matrices=False)
d = vt[0] if vt[0][0] > 0 else -vt[0]
ang = math.degrees(math.atan2(d[1], d[0]))
along = (pts - m) @ d
width = np.percentile(along, 99.5) - np.percentile(along, .5)
# firma nueva
f = ImageFont.truetype(os.path.join(B, "fonts", "pinyon-script-latin-400-normal.woff2"), 160)
can = Image.new("L", (1400, 340), 0)
dr = ImageDraw.Draw(can)
dr.text((40, 40), "Arnaldo Vallés", font=f, fill=255, stroke_width=4, stroke_fill=255)
bb = can.getbbox()
base = bb[1] + int((bb[3] - bb[1]) * .80)
dr.line([(bb[0] + 120, base + 40), (bb[2] - 60, base + 18)], fill=255, width=9)
can = can.crop(can.getbbox())
a = np.array(can).astype(np.float32) / 255.0
sc = width * 1.12 / a.shape[1]
a = cv2.resize(a, (int(a.shape[1] * sc), int(a.shape[0] * sc)), interpolation=cv2.INTER_AREA)
hh, ww = a.shape
M = cv2.getRotationMatrix2D((ww / 2, hh / 2), -ang, 1.0)
M[0, 2] += m[0] - ww / 2
M[1, 2] += m[1] - hh / 2 + 2
A = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_CUBIC)
A = cv2.GaussianBlur(A, (0, 0), 0.6) * (yy > caps_bottom + 4)
# oro de la propia firma original (percentil alto) con bisel y sombra
hi = np.percentile(im[gold], 92, axis=0)
bev = (A - np.roll(np.roll(A, 1, 0), 1, 1))[..., None]
goldc = np.clip(hi[None, None, :] * (1 + 0.3 * bev), 0, 255)
sh = np.roll(np.roll(A, 2, 0), 1, 1)[..., None]
out = clean * (1 - 0.5 * sh)
out = out * (1 - A[..., None]) + goldc * A[..., None]
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, optimize=True)
print("ángulo", round(ang, 1), "ancho", round(width))
