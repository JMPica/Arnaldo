import sys, numpy as np, cv2
from PIL import Image
src, dst, dbg = sys.argv[1:4]
im = np.array(Image.open(src).convert("RGB"))
x0, x1, y0, y1 = 455, 1020, 736, 880
reg = im[y0:y1, x0:x1].astype(int)
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
m = ((r - g > 70) & (r - b > 60)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
# shift por componente según su x absoluta
def shift_for(xabs, area):
    if area < 400: return None          # puntos: se eliminan
    if xabs < 780: return 20            # A R N A
    if xabs < 860: return 4             # L
    return -21                          # D O
k5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
full = np.zeros(im.shape[:2], np.uint8)
full[y0:y1, x0:x1] = cv2.dilate(m, k5)
plate = cv2.inpaint(im, full, 9, cv2.INPAINT_TELEA)
out = plate.astype(float)
k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
for i in range(1, n):
    x, y, w, h, a = st[i]
    dx = shift_for(x + x0, a)
    if a <= 15 or dx is None: continue
    cm = np.zeros(im.shape[:2], np.uint8)
    cm[y0:y1, x0:x1] = (lab == i).astype(np.uint8)
    cm = cv2.dilate(cm, k3)
    alpha = cv2.GaussianBlur(cm.astype(float), (0, 0), 2.0)
    M = np.float32([[1, 0, dx], [0, 1, 0]])
    a_s = cv2.warpAffine(alpha, M, (im.shape[1], im.shape[0]))
    p_s = cv2.warpAffine(im, M, (im.shape[1], im.shape[0])).astype(float)
    out = out * (1 - a_s[..., None]) + p_s * a_s[..., None]
res = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(res).save(dst, optimize=True)
Image.fromarray(res).crop((400, 700, 1080, 900)).resize((1360, 400)).save(dbg)
