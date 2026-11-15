"""NIST ITS-90 termokupl katsayıları (allcoeff.tab.txt) -> TypeScript veri modülü.

Kaynak: https://its90.nist.gov/downloadFiles/allcoeff.tab.txt
Kullanım: python3 -I scripts/nist-termokupl-katsayilari.py <allcoeff.tab.txt> src/lib/calc/defs/otomasyon/termokupl-nist.ts
"""
import re
import sys

src, out = sys.argv[1], sys.argv[2]
text = open(src, "rb").read().decode("latin1").replace("\r", "")
lines = text.split("\n")

ref = {}  # type -> {"ranges": [(tmin,tmax,[c...])], "exp": (a0,a1,a2)}
inv = {}  # type -> [(tmin,tmax,emin,emax,[d...],errmin,errmax)]

i = 0
cur = None
while i < len(lines):
    ln = lines[i]
    m = re.match(r"^type:\s*([A-Z])\s*$", ln)
    if m:
        cur = m.group(1)
        ref.setdefault(cur, {"ranges": [], "exp": None})
        i += 1
        continue
    m = re.match(r"^range:\s*([-\d.]+),\s*([-\d.]+),\s*(\d+)\s*$", ln)
    if m and cur:
        tmin, tmax, n = float(m.group(1)), float(m.group(2)), int(m.group(3))
        coeffs = []
        for k in range(n + 1):
            coeffs.append(lines[i + 1 + k].strip())
            float(coeffs[-1])
        ref[cur]["ranges"].append((tmin, tmax, coeffs))
        i += n + 2
        continue
    if ln.strip() == "exponential:" and cur:
        vals = []
        for k in range(3):
            mm = re.match(r"^\s*a(\d)\s*=\s*(\S+)\s*$", lines[i + 1 + k])
            assert mm and int(mm.group(1)) == k, lines[i + 1 + k]
            vals.append(mm.group(2))
        ref[cur]["exp"] = vals
        i += 4
        continue
    m = re.match(r"^Inverse coefficients for type ([A-Z]):", ln)
    if m:
        t = m.group(1)
        j = i + 1
        while not lines[j].strip().startswith("Temperature"):
            j += 1
        tlo = lines[j].split()[1:]
        thi = lines[j + 1].split()[1:]
        assert lines[j + 1].split()[0] == "Range:"
        j += 2
        while not lines[j].strip().startswith("Voltage"):
            j += 1
        elo = lines[j].split()[1:]
        ehi = lines[j + 1].split()[1:]
        assert lines[j + 1].split()[0] == "Range:"
        ncol = len(tlo)
        assert len(thi) == len(elo) == len(ehi) == ncol, (t, tlo, thi, elo, ehi)
        j += 2
        while lines[j].strip() == "":
            j += 1
        rows = []
        while lines[j].strip() != "":
            parts = lines[j].split()
            assert len(parts) == ncol, (t, lines[j])
            for p in parts:
                float(p)
            rows.append(parts)
            j += 1
        while not lines[j].strip().startswith("Error"):
            j += 1
        errlo = lines[j].split()[1:]
        assert lines[j + 1].split()[0] == "Range:"
        errhi = lines[j + 1].split()[1:]
        assert len(errlo) == len(errhi) == ncol, (t, errlo, errhi)
        cols = []
        for c in range(ncol):
            d = [r[c] for r in rows]
            while len(d) > 1 and float(d[-1]) == 0.0:
                d.pop()
            cols.append((float(tlo[c]), float(thi[c]), float(elo[c]), float(ehi[c]), d, float(errlo[c]), float(errhi[c])))
        inv[t] = cols
        i = j + 2
        continue
    i += 1

order = ["B", "E", "J", "K", "N", "R", "S", "T"]
assert sorted(ref) == order and sorted(inv) == order, (sorted(ref), sorted(inv))


def num(s):
    return repr(float(s))


def fmt(x):
    s = repr(float(x))
    return s[:-2] if s.endswith(".0") else s


o = []
o.append("/**")
o.append(" * NIST ITS-90 termokupl referans fonksiyonları ve yaklaşık ters fonksiyon katsayıları (°C, mV).")
o.append(" *")
o.append(" * BU DOSYA ÜRETİLMİŞTİR, ELLE DÜZENLEMEYİN. Kaynak (NIST SRD 60, ITS-90 Thermocouple Database):")
o.append(" *   https://its90.nist.gov/downloadFiles/allcoeff.tab.txt")
o.append(" *   (eski adres srdata.nist.gov/its90 buraya yönlenir)")
o.append(" * Katsayılar dosyadaki metinden sayıya birebir çevrilmiştir; ters fonksiyonlarda sondaki sıfır katsayılar atılmıştır.")
o.append(" * Referans: NIST Monograph 175 (1993), https://doi.org/10.6028/nist.mono.175 ; IEC 60584-1 aynı fonksiyonları kullanır.")
o.append(" */")
o.append("")
o.append('export type TermokuplTipi = "B" | "E" | "J" | "K" | "N" | "R" | "S" | "T";')
o.append("")
o.append("/** E = Σ cᵢ·tⁱ  (t: °C, E: mV), tMin ≤ t ≤ tMax */")
o.append("export interface ReferansAraligi {")
o.append("  tMin: number;")
o.append("  tMax: number;")
o.append("  c: readonly number[];")
o.append("}")
o.append("")
o.append("/** t = Σ dᵢ·Eⁱ  (E: mV, t: °C), eMin ≤ E ≤ eMax; NIST'in verdiği yaklaşım hatası errMin…errMax (°C) */")
o.append("export interface TersAralik {")
o.append("  tMin: number;")
o.append("  tMax: number;")
o.append("  eMin: number;")
o.append("  eMax: number;")
o.append("  d: readonly number[];")
o.append("  errMin: number;")
o.append("  errMax: number;")
o.append("}")
o.append("")
o.append("export interface TermokuplVerisi {")
o.append("  referans: readonly ReferansAraligi[];")
o.append("  /** Yalnızca K tipi, 0 °C üstü: E += a0·exp(a1·(t − a2)²) */")
o.append("  ustel?: { a0: number; a1: number; a2: number };")
o.append("  ters: readonly TersAralik[];")
o.append("}")
o.append("")
o.append("export const NIST_TERMOKUPL: Readonly<Record<TermokuplTipi, TermokuplVerisi>> = {")
for t in order:
    o.append(f"  {t}: {{")
    o.append("    referans: [")
    for tmin, tmax, c in ref[t]["ranges"]:
        o.append(f"      {{ tMin: {fmt(tmin)}, tMax: {fmt(tmax)}, c: [{', '.join(num(x) for x in c)}] }},")
    o.append("    ],")
    if ref[t]["exp"]:
        a0, a1, a2 = ref[t]["exp"]
        o.append(f"    ustel: {{ a0: {num(a0)}, a1: {num(a1)}, a2: {num(a2)} }},")
    o.append("    ters: [")
    for tmin, tmax, emin, emax, d, elo, ehi in inv[t]:
        o.append(
            f"      {{ tMin: {fmt(tmin)}, tMax: {fmt(tmax)}, eMin: {fmt(emin)}, eMax: {fmt(emax)}, "
            f"d: [{', '.join(num(x) for x in d)}], errMin: {fmt(elo)}, errMax: {fmt(ehi)} }},"
        )
    o.append("    ],")
    o.append("  },")
o.append("};")
o.append("")
open(out, "w").write("\n".join(o))
print("ok", {t: (len(ref[t]["ranges"]), len(inv[t]), bool(ref[t]["exp"])) for t in order})
