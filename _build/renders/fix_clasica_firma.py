# Retoque de la anilla clásica (render favorito del promotor): la IA escribió una firma inventada
# («Arnald Jonato»). Se borra sobre la laca negra y se escribe «Arnaldo» en caligrafía provisional
# (Pinyon Script, oro), con la inclinación del nombre. La firma real de Arnaldo la sustituirá.
import sys, os, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
src, dst = sys.argv[1:3]
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.array(Image.open(src).convert("RGB"))
H, W, _ = im.shape
r, g, b = [im[..., i].astype(int) for i in range(3)]
yy, xx = np.mgrid[0:H, 0:W]
line = 470 - (xx - 470) * 100 / 265                       # línea de base de ARNALDO
oval = ((xx - 595) / 150.0) ** 2 + ((yy - 430) / 122.0) ** 2 < 1.0
ring = 480 - 0.846 * (xx - 715)                       # filete interior del óvalo (abajo a la derecha)
region = oval & (yy > line + 9) & (yy < ring - 10) & (xx > 520) & (xx < 717) & (yy < 535)
gold = (r > 70) & (r > b + 25)
# solo dentro de la laca negra: componente oscuro principal con sus huecos rellenos (las letras),
# sin cerrar el filete de oro interior del óvalo
dark = ((r + g + b) < 150).astype(np.uint8)
n, lab = cv2.connectedComponents(dark)
comp = (lab == lab[300, 560]).astype(np.uint8)
ff = comp.copy() * 255
cv2.floodFill(ff, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 128)
lac = cv2.erode(((ff != 128)).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
region &= lac
mask = (region & gold).astype(np.uint8)
mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
clean = cv2.inpaint(im, mask, 7, cv2.INPAINT_TELEA)
# firma provisional
font = ImageFont.truetype(os.path.join(B, "fonts", "pinyon-script-latin-400-normal.woff2"), 120)
can = Image.new("L", (900, 260), 0)
d = ImageDraw.Draw(can)
d.text((40, 20), "Arnaldo", font=font, fill=255, stroke_width=2, stroke_fill=255)
bbox = can.getbbox()
d.line([(bbox[0] + 60, bbox[3] + 4), (bbox[2] + 10, bbox[3] - 14)], fill=255, width=5)   # rúbrica
can = can.crop(can.getbbox())
w0 = 175                                                  # ancho en la imagen
can = can.resize((w0, round(can.height * w0 / can.width)), Image.LANCZOS)
can = can.rotate(19.5, expand=True, resample=Image.BICUBIC)
a = np.zeros((H, W), np.float32)
cx, cy = 628, 470
x0, y0 = cx - can.width // 2, cy - can.height // 2
a[y0:y0 + can.height, x0:x0 + can.width] = np.array(can, np.float32) / 255.0
a = cv2.GaussianBlur(a, (0, 0), 0.5)
# color oro tomado de las letras de ARNALDO
sel = gold & oval & (yy < line - 4)
col = np.median(im[sel], axis=0)
hi = np.minimum(col * 1.1, 255)
shade = (0.85 + 0.3 * np.clip((yy - (cy - 20)) / 40.0, 0, 1))[..., None]   # degradado vertical suave
goldfill = np.clip(hi[None, None, :] / shade, 0, 255)
sh = np.roll(np.roll(a, 1, 0), 1, 1)[..., None]           # sombra de relieve
out = clean.astype(float) * (1 - 0.5 * sh)
out = out * (1 - a[..., None]) + goldfill * a[..., None]
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, optimize=True)
