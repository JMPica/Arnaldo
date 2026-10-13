# Retoque A3-4: borra la marca a fuego mal escrita («ARNADO») y graba «ARNALDO» en Cinzel,
# en el plano de la tapa, con aspecto de pirograbado (multiplicado sobre la madera + halo).
import sys, os, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
src, dst = sys.argv[1:3]
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.array(Image.open(src).convert("RGB"))
H, W, _ = im.shape
lum = im.mean(2)
poly = np.array([[440, 540], [425, 478], [1010, 380], [1030, 450]], np.int32)
region = np.zeros((H, W), np.uint8)
cv2.fillConvexPoly(region, poly, 1)
dark = ((lum < 95) & (region > 0)).astype(np.uint8)
mask = cv2.dilate(dark, np.ones((5, 5), np.uint8))
smooth = cv2.inpaint(im, mask, 6, cv2.INPAINT_TELEA).astype(float)
# veta real: misma tapa desplazada hacia abajo (zona limpia), ajustada a la luz local
shift = 115
src_w = np.roll(im, -shift, axis=0).astype(float)
k = (0, 0)
ratio = cv2.GaussianBlur(smooth, k, 12) / np.maximum(cv2.GaussianBlur(src_w, k, 12), 1)
grain = np.clip(src_w * ratio, 0, 255)
feather = np.clip(cv2.GaussianBlur(cv2.dilate(mask, np.ones((15, 15), np.uint8)).astype(float), k, 7.0) * 1.3, 0, 1)[..., None]
wood = im.astype(float) * (1 - feather) + grain * feather
# texto en un lienzo plano
font = ImageFont.truetype(os.path.join(B, "fonts", "cinzel-latin-700-normal.woff2"), 120)
txt = "ARNALDO"
tw, th = 1400, 180
can = Image.new("L", (tw, th), 0)
d = ImageDraw.Draw(can)
x = 20
for ch in txt:
    d.text((x, 20), ch, font=font, fill=255)
    x += d.textlength(ch, font=font) + 22
used = x - 22 + 20
can = np.array(can).astype(np.float32)[:, :int(used)]
h_c, w_c = can.shape
# afín: esquinas del texto (inferior izq., inferior der., superior izq.) → plano de la tapa
cap_top, base = 30, 20 + 120 * 0.72 + 12          # banda útil del lienzo
src_pts = np.float32([[0, base], [w_c, base], [0, cap_top]])
bl = np.array([470.0, 522.0]); br = np.array([1000.0, 428.0])
up = np.array([-0.50, -0.866]) * 64
dst_pts = np.float32([bl, br, bl + up])
M = cv2.getAffineTransform(src_pts, dst_pts)
a = cv2.warpAffine(can, M, (W, H), flags=cv2.INTER_CUBIC) / 255.0
a = cv2.GaussianBlur(a, (0, 0), 0.9)
halo = cv2.GaussianBlur(a, (0, 0), 3.5)
burn = np.clip(0.80 * a + 0.22 * halo, 0, 1)[..., None]
tint = np.array([62, 28, 10], float)
out = wood * (1 - burn) + tint * burn * 0.9 + wood * burn * 0.1
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, optimize=True)
