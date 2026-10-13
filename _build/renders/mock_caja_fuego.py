# Maqueta: sobre la caja de cedro A3-4 se borra la marca generada y se graba a fuego la marca de la casa
# (ARNALDO entre filetes + firma provisional, arte vectorial) proyectada en el plano de la tapa (homografía).
import sys, os, numpy as np, cv2
from PIL import Image
src, stamp, dst = sys.argv[1:4]
im = np.array(Image.open(src).convert("RGB"))
H, W, _ = im.shape
lum = im.mean(2)
# 1) borrar la marca original con veta real (mismo método que fix_a34_branding.py)
poly = np.array([[440, 540], [425, 478], [1010, 380], [1030, 450]], np.int32)
region = np.zeros((H, W), np.uint8)
cv2.fillConvexPoly(region, poly, 1)
mask = cv2.dilate(((lum < 95) & (region > 0)).astype(np.uint8), np.ones((5, 5), np.uint8))
smooth = cv2.inpaint(im, mask, 6, cv2.INPAINT_TELEA).astype(float)
src_w = np.roll(im, -115, axis=0).astype(float)
ratio = cv2.GaussianBlur(smooth, (0, 0), 12) / np.maximum(cv2.GaussianBlur(src_w, (0, 0), 12), 1)
grain = np.clip(src_w * ratio, 0, 255)
feather = np.clip(cv2.GaussianBlur(cv2.dilate(mask, np.ones((15, 15), np.uint8)).astype(float), (0, 0), 7.0) * 1.3, 0, 1)[..., None]
wood = im.astype(float) * (1 - feather) + grain * feather
# 2) plano de la tapa: esquinas fondo-izq., fondo-der., frente-der., frente-izq.
quad = np.float32([[30, 398], [1098, 222], [1372, 512], [238, 716]])
unit = np.float32([[0, 0], [1, 0], [1, 1], [0, 1]])
Hm = cv2.getPerspectiveTransform(unit, quad)
st = np.array(Image.open(stamp).convert("RGBA")).astype(np.float32)[..., 3] / 255.0
sh, sw = st.shape
u0, u1 = 0.28, 0.72                       # ancho del sello en la tapa
vspan = (u1 - u0) * 2.5 * sh / sw        # proporción aparente de la tapa calibrada con las letras del render
v0 = 0.45 - vspan / 2
S = np.float32([[0, 0], [sw, 0], [sw, sh], [0, sh]])
D = cv2.perspectiveTransform(np.float32([[[u0, v0], [u1, v0], [u1, v0 + vspan], [u0, v0 + vspan]]]), Hm)[0]
M = cv2.getPerspectiveTransform(S, D)
a = cv2.warpPerspective(st, M, (W, H), flags=cv2.INTER_AREA)
a = cv2.GaussianBlur(a, (0, 0), 0.8)
halo = cv2.GaussianBlur(a, (0, 0), 3.0)
burn = np.clip(0.82 * a + 0.20 * halo, 0, 1)[..., None]
tint = np.array([58, 26, 9], float)
out = wood * (1 - burn) + tint * burn * 0.9 + wood * burn * 0.1
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, optimize=True)
