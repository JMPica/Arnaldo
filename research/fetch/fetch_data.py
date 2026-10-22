"""Descarga datos históricos reales para la investigación de APEX.

Se ejecuta en GitHub Actions (el entorno de desarrollo no tiene salida a los
exchanges). Escribe CSV comprimidos en research/data/ con columnas
ts,open,high,low,close,volume (ts = epoch en segundos UTC, apertura de la vela).
"""
import csv, gzip, io, json, os, sys, time, zipfile, datetime as dt
import urllib.request, urllib.error

OUT = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "apex-research/1.0"}
REPORT = {}


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            err = e
        except Exception as e:  # red inestable
            err = e
        time.sleep(2 ** i)
    print(f"FALLO {url}: {err}", file=sys.stderr)
    return None


def write_rows(name, rows, header=("ts", "open", "high", "low", "close", "volume")):
    rows = sorted({r[0]: r for r in rows}.values())
    with gzip.open(os.path.join(OUT, f"{name}.csv.gz"), "wt", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    REPORT[name] = {"rows": len(rows), "from": rows[0][0] if rows else None, "to": rows[-1][0] if rows else None}
    print(name, REPORT[name], flush=True)


def months(start, end):
    y, m = start
    while (y, m) <= end:
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def binance_klines():
    today = dt.date.today()
    last_full = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
    rows = []
    for y, m in months((2017, 8), last_full):
        b = get(f"https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1h/BTCUSDT-1h-{y}-{m:02d}.zip")
        if b:
            rows += parse_kline_zip(b)
    d = dt.date(today.year, today.month, 1)
    while d < today:
        b = get(f"https://data.binance.vision/data/spot/daily/klines/BTCUSDT/1h/BTCUSDT-1h-{d.isoformat()}.zip")
        if b:
            rows += parse_kline_zip(b)
        d += dt.timedelta(days=1)
    write_rows("BTC_binance_1h", rows)


def parse_kline_zip(b):
    out = []
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        for n in z.namelist():
            for line in z.read(n).decode().splitlines():
                p = line.split(",")
                if not p[0].isdigit():
                    continue
                t = int(p[0])
                t = t // 1_000_000 if t > 10**14 else t // 1000  # µs desde 2025
                out.append((t, float(p[1]), float(p[2]), float(p[3]), float(p[4]), float(p[5])))
    return out


def binance_funding():
    today = dt.date.today()
    last_full = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
    rows = []
    for y, m in months((2019, 9), last_full):
        b = get(f"https://data.binance.vision/data/futures/um/monthly/fundingRate/BTCUSDT/BTCUSDT-fundingRate-{y}-{m:02d}.zip")
        if not b:
            continue
        with zipfile.ZipFile(io.BytesIO(b)) as z:
            for n in z.namelist():
                for line in z.read(n).decode().splitlines():
                    p = line.split(",")
                    if p[0].isdigit():
                        rows.append((int(p[0]) // 1000, float(p[2])))
    write_rows("BTC_binance_funding", rows, header=("ts", "rate"))


def kraken():
    base = "https://futures.kraken.com"
    ins = get(f"{base}/derivatives/api/v3/instruments")
    if ins:
        data = json.loads(ins)
        keep = [i for i in data.get("instruments", []) if "XBT" in i.get("symbol", "").upper()]
        with open(os.path.join(OUT, "kraken_instruments_xbt.json"), "w") as f:
            json.dump(keep, f, indent=1)
        summary = [{k: i.get(k) for k in ("symbol", "type", "contractSize", "contractValueTradePrecision", "tickSize", "tradeable", "base", "quote")} for i in data.get("instruments", [])]
        with open(os.path.join(OUT, "kraken_instruments_all.json"), "w") as f:
            json.dump(summary, f)
        REPORT["kraken_instruments"] = len(summary)
    tick = get(f"{base}/derivatives/api/v3/tickers/PF_XBTUSD")
    if tick:
        with open(os.path.join(OUT, "kraken_ticker_pf_xbtusd.json"), "wb") as f:
            f.write(tick)
    rows, end = [], int(time.time())
    start = end - 5 * 365 * 86400
    t = start
    while t < end:
        b = get(f"{base}/api/charts/v1/trade/PF_XBTUSD/1h?from={t}&to={min(end, t + 2000 * 3600)}")
        if b:
            for c in json.loads(b).get("candles", []):
                rows.append((int(c["time"]) // 1000, float(c["open"]), float(c["high"]), float(c["low"]), float(c["close"]), float(c.get("volume", 0))))
        t += 2000 * 3600
    if rows:
        write_rows("BTC_kraken_pf_1h", rows)
    # Comprobación de alineación de las velas 4h/1d que usa el motor en vivo.
    for tf, span in (("4h", 14400), ("1d", 86400)):
        b = get(f"{base}/api/charts/v1/trade/PF_XBTUSD/{tf}?from={end - 400 * span}&to={end}")
        if b:
            cs = json.loads(b).get("candles", [])
            ts = [int(c["time"]) // 1000 for c in cs]
            REPORT[f"kraken_{tf}_alignment"] = {"candles": len(ts), "aligned_utc": all(t % span == 0 for t in ts), "first": ts[:2], "last": ts[-2:]}
    fr = get(f"{base}/derivatives/api/v4/historicalfundingrates?symbol=PF_XBTUSD")
    if fr:
        rates = json.loads(fr).get("rates", [])
        out = []
        for r in rates:
            ts = int(dt.datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00")).timestamp())
            out.append((ts, float(r.get("relativeFundingRate", 0))))
        write_rows("BTC_kraken_funding", out, header=("ts", "rate"))


def coinbase():
    b = get("https://api.coinbase.com/api/v3/brokerage/market/products?product_type=FUTURE&limit=500")
    if b:
        with open(os.path.join(OUT, "coinbase_futures_products.json"), "wb") as f:
            f.write(b)
        REPORT["coinbase_futures_products"] = len(json.loads(b).get("products", []))


def oanda():
    from huggingface_hub import HfApi, hf_hub_download
    import pandas as pd
    api = HfApi()
    sets = {"BTC": "BTCUSD_Bitcoin", "GOLD": "XAUUSD_Gold", "SILVER": "XAGUSD_Silver", "COPPER": "XCUUSD_Copper",
            "PLATINUM": "XPTUSD_Platinum", "OIL": "WTICOUSD_West-Texas-Oil", "NATGAS": "NATGASUSD_Natural-Gas",
            "EURUSD": "EURUSD_EURUSD"}
    for sym, ds in sets.items():
        repo = f"bunqi/OANDA_{ds}"
        try:
            # Velas diarias: 2 ficheros por activo (las horarias son cientos y
            # la descarga anónima de Hugging Face se limita por frecuencia).
            files = [f for f in api.list_repo_files(repo, repo_type="dataset") if f.startswith("D/") and f.endswith(".parquet")]
        except Exception as e:
            print("sin dataset", repo, e)
            continue
        frames = [pd.read_parquet(hf_hub_download(repo, f, repo_type="dataset")) for f in files]
        df = pd.concat(frames)
        if sym == "BTC":
            print(df.columns.tolist(), df.head(2).to_dict("records"))
        cols = {c.lower(): c for c in df.columns if c.lower() not in {x.lower() for x in df.columns if x != c and x.lower() == c.lower() and x == x.lower()}}
        if "time" in df.columns and pd.api.types.is_numeric_dtype(df["time"]):
            ts = df["time"].astype("int64")  # epoch en segundos
        else:
            tcol = next(cols[c] for c in ("time", "timestamp", "date", "datetime", "ts") if c in cols)
            ts = pd.to_datetime(df[tcol], utc=True).dt.as_unit("s").astype("int64")
        pick = lambda *names: next(df[cols[n]] for n in names if n in cols)
        o = pick("open", "mid_o", "o", "mid.o")
        h = pick("high", "mid_h", "h", "mid.h")
        l = pick("low", "mid_l", "l", "mid.l")
        c = pick("close", "mid_c", "c", "mid.c")
        v = pick("volume", "v") if ("volume" in cols or "v" in cols) else c * 0
        rows = list(zip(ts.tolist(), o.astype(float), h.astype(float), l.astype(float), c.astype(float), v.astype(float)))
        write_rows(f"{sym}_oanda_1d", rows)


if __name__ == "__main__":
    only = set(sys.argv[1:])
    if os.path.exists(os.path.join(OUT, "fetch_report.json")):
        REPORT.update(json.load(open(os.path.join(OUT, "fetch_report.json"))))
    for fn in (coinbase, kraken, binance_funding, binance_klines, oanda):
        if only and fn.__name__ not in only:
            continue
        try:
            fn()
        except Exception as e:
            print(f"ERROR en {fn.__name__}: {e!r}", file=sys.stderr)
            REPORT[f"error_{fn.__name__}"] = repr(e)
    REPORT["fetched_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    with open(os.path.join(OUT, "fetch_report.json"), "w") as f:
        json.dump(REPORT, f, indent=1)
