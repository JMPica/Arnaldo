# Retoque A3-3: elimina el trazo «1» y la tilde inventados sobre ARNALDO y sustituye la segunda A
# (atravesada por el trazo) por una copia de la primera A de la misma imagen.
import sys, numpy as np, cv2
from PIL import Image
src, dst = sys.argv[1:3]
im = np.array(Image.open(src).convert("RGB"))
f = im.astype(int)
R, G, B = f[..., 0], f[..., 1], f[..., 2]
gold = ((R > 140) & (G > 95) & (B < 140) & (G > B + 15)).astype(np.uint8)
H, W = gold.shape
region = np.zeros((H, W), np.uint8)
cv2.rectangle(region, (762, 296), (880, 616), 1, -1)      # segunda A + tramo central del trazo
cv2.rectangle(region, (870, 300), (968, 396), 1, -1)      # tramo superior del trazo (sobre la L)
cv2.rectangle(region, (745, 300), (895, 334), 1, -1)      # tilde
mask = cv2.dilate(gold & region, np.ones((7, 7), np.uint8))
out = cv2.inpaint(im, mask, 7, cv2.INPAINT_TELEA)
# primera A: componente oro en x 560–650, y 390–535
box = (560, 388, 652, 536)
a_src = im[box[1]:box[3], box[0]:box[2]]
a_mask = gold[box[1]:box[3], box[0]:box[2]]
a_mask = cv2.dilate(a_mask, np.ones((5, 5), np.uint8)).astype(float)
a_mask = cv2.GaussianBlur(a_mask, (0, 0), 1.2)[..., None]
dx = 216  # desplazamiento hasta la posición de la segunda A
x0, y0 = box[0] + dx, box[1]
roi = out[y0:box[3], x0:x0 + (box[2] - box[0])].astype(float)
out[y0:box[3], x0:x0 + (box[2] - box[0])] = np.clip(roi * (1 - a_mask) + a_src * a_mask, 0, 255).astype(np.uint8)
Image.fromarray(out).save(dst, optimize=True)
