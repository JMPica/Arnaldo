# -*- coding: utf-8 -*-
"""Maquetas fotográficas de la anilla clásica: foto sin texto (Qwen-Image) + arte vectorial compuesto.

  puro      anilla Nº 1 + «Pliego de autor» envolviendo el cilindro (proyección cilíndrica, luz de la foto)
  vitolas   Nº 1, Nº 2 y Nº 3 sobre las tres vitolas (se borra la anilla lisa de la foto y se recorta el pie)
  caja      marca a fuego en la tapa de la caja clavada (homografía)
  abierta   vista en el interior de la tapa (homografía), encuadrada en la tapa

Uso: python3 compose_fotos.py RENDERS_DIR ASSETS_DIR [puro|vitolas|caja|abierta ...]"""
import sys, os, math, numpy as np, cv2
from PIL import Image

REN, ART = sys.argv[1], sys.argv[2]
JOBS = sys.argv[3:] or ["puro", "vitolas", "caja", "abierta"]
D_MM = 19.8                                  # diámetro del cepo 50
MM = 20                                      # px por mm del arte de anilla (brand_clasica.py)


def load(name):
    return np.array(Image.open(os.path.join(REN, name)).convert("RGB")).astype(np.float32)


def art(name):
    a = np.array(Image.open(os.path.join(ART, name)).convert("RGBA")).astype(np.float32)
    return a[..., :3], a[..., 3] / 255.0


def save(arr, name):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(REN, name), optimize=True)


def ivory_mask(im):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    return (r > 165) & (g > 150) & (b > 120) & (np.abs(r - b) < 75)


def wrap_band(im, rgb, alpha, xc, R, y_top, y_bot, body_mm, light, art_cy=None, cover=None):
    """Envuelve el arte (desarrollo plano) alrededor de un cilindro vertical de radio R px centrado en xc.
    El cuerpo de la anilla (body_mm) ocupa de y_top a y_bot; light = iluminación por columna (0..1.2)."""
    H, W, _ = im.shape
    ah, aw = alpha.shape
    pxmm = (y_bot - y_top) / body_mm          # px de la foto por mm
    art_cy = ah / 2 if art_cy is None else art_cy
    yc = (y_top + y_bot) / 2
    xs = np.arange(int(xc - R), int(xc + R) + 1)
    u = np.clip((xs - xc) / R, -0.999, 0.999)
    s_mm = np.arcsin(u) * (D_MM / 2) * (2 * R / (D_MM * pxmm))   # longitud de arco en mm del desarrollo
    ax = aw / 2 + s_mm * MM
    half = (ah / 2) / MM * pxmm
    ys = np.arange(int(yc - half) - 1, int(yc + half) + 2)
    ay = art_cy + (ys - yc) / pxmm * MM
    mx, my = np.meshgrid(ax.astype(np.float32), ay.astype(np.float32))
    col = cv2.remap(rgb, mx, my, cv2.INTER_AREA if False else cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    al = cv2.remap(alpha, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    lt = light[np.clip(xs, 0, W - 1)][None, :, None]
    # sombra suave en los bordes del cilindro (la anilla gira) + luz de la foto
    edge = (0.55 + 0.45 * np.sqrt(1 - u ** 2))[None, :, None]
    col = col * lt * edge
    out = im.copy()
    y0, x0 = ys[0], xs[0]
    sl = out[y0:y0 + len(ys), x0:x0 + len(xs)]
    a3 = al[..., None]
    out[y0:y0 + len(ys), x0:x0 + len(xs)] = sl * (1 - a3) + col * a3
    if cover is not None:
        cover[y0:y0 + len(ys), x0:x0 + len(xs)] = np.maximum(cover[y0:y0 + len(ys), x0:x0 + len(xs)], al)
    # sombra de contacto bajo el canto inferior del cuerpo
    return out


def band_light(im, mask, rows):
    """Iluminación por columna a partir de la anilla lisa (papel uniforme): luminancia normalizada."""
    lum = im.mean(2)
    H, W = lum.shape
    light = np.ones(W, np.float32)
    sel = mask[rows[0]:rows[1]]
    vals = np.where(sel, lum[rows[0]:rows[1]], np.nan)
    colv = np.nanmedian(vals, axis=0)
    ref = np.nanpercentile(colv, 95)
    ok = ~np.isnan(colv)
    light[ok] = np.clip(colv[ok] / ref, 0.25, 1.1)
    # rellena fuera de la anilla con el valor del borde más cercano
    idx = np.nonzero(ok)[0]
    if len(idx):
        light[:idx[0]] = light[idx[0]]
        light[idx[-1]:] = light[idx[-1]]
    return cv2.GaussianBlur(light[None, :], (0, 0), 3)[0]


def erase_band(im, mask, grow=4):
    """Borra la anilla lisa de la foto con relleno de la capa del puro (inpainting)."""
    m = cv2.dilate(mask.astype(np.uint8), np.ones((grow * 2 + 1, grow * 2 + 1), np.uint8))
    return cv2.inpaint(np.clip(im, 0, 255).astype(np.uint8), m, 9, cv2.INPAINT_TELEA).astype(np.float32)


# ------------------------------------------------------------------ puro con la anilla Nº 1
def job_puro():
    im = load("arnaldo-v4-p1-puro-anilla-lisa.png")
    m = ivory_mask(im)
    m[:300] = False
    m[700:] = False
    ys, xs = np.nonzero(m)
    y_top, y_bot = np.percentile(ys, 0.5), np.percentile(ys, 99.5)
    x_l, x_r = np.percentile(xs, 0.5), np.percentile(xs, 99.5)
    light = band_light(im, m, (int(y_top) + 8, int(y_bot) - 8))
    base = erase_band(im, m)
    rgb, al = art("arnaldo-anilla-n1.png")
    out = wrap_band(base, rgb, al, (x_l + x_r) / 2, (x_r - x_l) / 2, y_top, y_bot, 16.0, light * 1.08)
    # segunda anilla «Pliego de autor» justo debajo (7 mm), con 1 mm de separación
    pxmm = (y_bot - y_top) / 16.0
    p_rgb, p_al = art("arnaldo-anilla-pliego.png")
    yt2 = y_bot + 1.0 * pxmm
    out = wrap_band(out, p_rgb, p_al, (x_l + x_r) / 2, (x_r - x_l) / 2 * 0.985, yt2, yt2 + 7 * pxmm, 7.0, light * 1.08)
    save(out, "arnaldo-puro-anilla.png")


# ------------------------------------------------------------------ tres vitolas
def job_vitolas():
    im = load("arnaldo-v4-p2-tres-vitolas-lisas.png")
    H, W, _ = im.shape
    m = ivory_mask(im)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    comps = sorted([i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 3000], key=lambda i: stats[i, 0])
    names = ["arnaldo-anilla-n1.png", "arnaldo-anilla-n2.png", "arnaldo-anilla-n3-negra.png"]
    out = im.copy()
    for i, nm in zip(comps, names):
        x, y, w, h, _ = stats[i]
        cm = lab == i
        widths = cm.sum(1)
        full = np.nonzero(widths > 0.97 * widths.max())[0]
        light = band_light(im, cm, (full.min() + 3, full.max() - 3))
        rgb, al = art(nm)
        # se cubre la anilla lisa entera sin borrarla: el óvalo del arte (20 mm) iguala la altura del óvalo
        # de la foto y el desarrollo envuelve también el papel en sombra del lado izquierdo
        pxmm = (h + 10) / 20.0
        yc = y + h / 2
        R = (w + 16) / 2
        cover = np.zeros(im.shape[:2], np.float32)
        out = wrap_band(out, rgb, al, x + w / 2 - 5, R, yc - 8 * pxmm, yc + 8 * pxmm, 16.0, light * 1.05, cover=cover)
        # restos de la anilla lisa que el arte no cubre (papel en sombra): se rellenan con la capa del puro
        hsv = cv2.cvtColor(np.clip(im, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV)
        box = np.zeros(cm.shape, bool)
        box[max(0, y - 8):y + h + 8, max(0, x - 26):x + w + 8] = True
        rest = box & (cover < 0.5) & (hsv[..., 1] < 160) & (hsv[..., 2] > 35)
        rest = cv2.dilate(rest.astype(np.uint8), np.ones((5, 5), np.uint8)) & (cover < 0.5)
        if rest.any():
            fill = cv2.inpaint(np.clip(out, 0, 255).astype(np.uint8), rest.astype(np.uint8), 7, cv2.INPAINT_TELEA).astype(np.float32)
            out = np.where(rest[..., None] > 0, fill, out)
    crop_y = int(min(890, H))                 # fuera los pies (ceniza generada por la IA); encuadre vertical
    save(out[90:crop_y, 330:1130], "arnaldo-tres-vitolas.png")


# ------------------------------------------------------------------ marca a fuego en la caja clavada
def job_caja():
    im = load("arnaldo-v4-p3-caja-clavada.png")
    H, W, _ = im.shape
    quad = np.float32([[168, 402], [1012, 182], [1290, 408], [400, 676]])   # fondo-izq, fondo-der, frente-der, frente-izq
    Hm = cv2.getPerspectiveTransform(np.float32([[0, 0], [1, 0], [1, 1], [0, 1]]), quad)
    st = np.array(Image.open(os.path.join(ART, "arnaldo-marca-fuego.png")).convert("RGBA")).astype(np.float32)[..., 3] / 255.0
    sh, sw = st.shape
    u0, u1 = 0.24, 0.76
    vspan = (u1 - u0) * 2.0 * sh / sw          # tapa ≈ 2:1 (ancho:fondo)
    v0 = 0.42 - vspan / 2
    S = np.float32([[0, 0], [sw, 0], [sw, sh], [0, sh]])
    Dq = cv2.perspectiveTransform(np.float32([[[u0, v0], [u1, v0], [u1, v0 + vspan], [u0, v0 + vspan]]]), Hm)[0]
    M = cv2.getPerspectiveTransform(S, Dq)
    a = cv2.warpPerspective(st, M, (W, H), flags=cv2.INTER_AREA)
    a = cv2.GaussianBlur(a, (0, 0), 0.7)
    halo = cv2.GaussianBlur(a, (0, 0), 2.5)
    burn = np.clip(0.80 * a + 0.22 * halo, 0, 1)[..., None]
    tint = np.array([70, 34, 14], np.float32)
    out = im * (1 - burn) + tint * burn * 0.88 + im * burn * 0.12
    save(out, "arnaldo-caja-marca-fuego.png")


# ------------------------------------------------------------------ caja abierta: vista + anillas
def job_abierta():
    im = load("arnaldo-v4-p4-caja-abierta-lisa.png")
    H, W, _ = im.shape
    lum = im.mean(2)
    # panel marfil del interior de la tapa, medido sobre la foto (dentro del filete de oro)
    quad = np.float32([[252, 270], [948, 54], [960, 392], [332, 620]])
    k_mask = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(k_mask, quad.astype(np.int32), 1)
    va = np.array(Image.open(os.path.join(ART, "arnaldo-vista.png")).convert("RGBA")).astype(np.float32)
    vh, vw = va.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [vw, 0], [vw, vh], [0, vh]]), quad)
    warped = cv2.warpPerspective(va, M, (W, H), flags=cv2.INTER_AREA)
    a = warped[..., 3:4] / 255.0
    # luz de la foto: luminancia del panel liso, normalizada
    light = cv2.GaussianBlur(lum, (0, 0), 25)[..., None] / max(np.percentile(lum[k_mask > 0], 90), 1)
    out = im * (1 - a) + warped[..., :3] * np.clip(light, 0.5, 1.1) * a
    # encuadre en la tapa: las anillas de la bandeja (lisas en la foto) quedan fuera
    out = out[0:640, 140:1000]
    save(out, "arnaldo-caja-abierta.png")
    return quad


if __name__ == "__main__":
    for j in JOBS:
        r = globals()["job_" + j]()
        print("OK", j, "" if r is None else r.tolist())
