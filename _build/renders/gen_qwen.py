# -*- coding: utf-8 -*-
"""Genera renders con el Space mcp-tools/Qwen-Image (Gradio API, cuota ZeroGPU de la cuenta HF).
Uso: python3 gen_qwen.py queue.json OUTDIR [id ...] [--seeds N]
La cuenta se autentica mediante el secreto de red del entorno (cabecera Authorization)."""
import json, ssl, sys, os, urllib.request

BASE = "https://mcp-tools-qwen-image.hf.space/gradio_api"
CA = "/root/.ccr/ca-bundle.crt"
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else ssl.create_default_context()


def req(url, data=None):
    r = urllib.request.Request(url, data=json.dumps(data).encode() if data else None,
                               headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(r, context=CTX, timeout=600)


def generate(prompt, ar, neg, seed=0, steps=16, guidance=4.0):
    ev = json.load(req(f"{BASE}/call/generate_image",
                       {"data": [prompt, seed, seed == 0, ar, neg, guidance, steps]}))["event_id"]
    event = None
    for line in req(f"{BASE}/call/generate_image/{ev}"):
        line = line.decode().strip()
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:") and event in ("complete", "error"):
            if event == "error":
                raise RuntimeError(line[5:].strip())
            img, seed_txt = json.loads(line[5:].strip())
            return img["url"], seed_txt
    raise RuntimeError("sin respuesta")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    nseeds = int(next((a.split("=")[1] for a in sys.argv if a.startswith("--seeds=")), 1))
    queue, outdir, only = json.load(open(args[0])), args[1], set(args[2:])
    from PIL import Image
    import io
    for job in queue:
        if only and job["id"] not in only:
            continue
        for k in range(nseeds):
            name = job["id"] + (f"-s{k + 1}" if nseeds > 1 else "")
            try:
                url, seed = generate(job["prompt"], job["ratio"], job["negative"])
            except Exception as e:
                print(f"FAIL {name}: {e}", flush=True)
                if "quota" in str(e).lower():
                    return 2
                continue
            data = req(url).read()
            Image.open(io.BytesIO(data)).convert("RGB").save(os.path.join(outdir, name + ".png"), optimize=True)
            print(f"OK {name} ({seed})", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
