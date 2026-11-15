import { describe, expect, it } from "vitest";
import { runCalc, defaultState } from "@/lib/calc/engine";
import { getCalc } from "@/lib/calc/registry";
import { IMPERIAL_BIRIMLER, runSecenekleri } from "./tercihler";

describe("kullanıcı tercihleri → runCalc seçenekleri", () => {
  it("tercih yoksa seçenek yok; SI'da yalnızca anlamlı basamak", () => {
    expect(runSecenekleri(null)).toEqual({});
    expect(runSecenekleri({ anlamliBasamak: 5, birimSistemi: "si" })).toEqual({ significant: 5 });
  });

  it("imperial: tork, basınç, sıcaklık öncelikli; güç hp'ye çevrilmez", () => {
    expect(runSecenekleri({ anlamliBasamak: 4, birimSistemi: "imperial" }).preferredUnits).toBe(IMPERIAL_BIRIMLER);
    expect(IMPERIAL_BIRIMLER).not.toHaveProperty("guc");
    // Ohm yasası imperial tercihte de mW/W göstermeli (12 V, 2,2 kΩ → 65,45 mW)
    const ohm = getCalc("ohm-yasasi")!;
    const r = runCalc(
      ohm,
      { ...defaultState(ohm), mod: { value: "V-R" }, V: { value: "12", unit: "V" }, R: { value: "2,2", unit: "kohm" } },
      runSecenekleri({ anlamliBasamak: 4, birimSistemi: "imperial" }),
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.outputs.find((o) => o.key === "P")?.unit).toBe("mW");
    // Motor torku imperial'de lbf·ft
    const tork = getCalc("guc-tork-devir")!;
    const t = runCalc(tork, defaultState(tork), runSecenekleri({ anlamliBasamak: 4, birimSistemi: "imperial" }));
    if (!t.ok) throw new Error(JSON.stringify(t));
    expect(t.outputs.find((o) => o.key === "T")?.unit).toBe("lbfft");
  });
});
