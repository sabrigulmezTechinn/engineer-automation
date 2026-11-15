import { describe, expect, it } from "vitest";
import type { CalcDefinition, Reference } from "@/lib/calc/types";
import { compareKapsamId, sortByKapsamId } from "./calc/kapsam";
import { groupReferencesByStandard, referenceDetail, standardAnchor } from "./standards";

function calc(id: string, references: Reference[]): CalcDefinition {
  return {
    id,
    slug: `hesap-${id.replace(".", "-")}`,
    category: "temel-elektrik",
    title: `Hesap ${id}`,
    description: "",
    formulas: [],
    references,
    inputs: [],
    outputs: [],
    compute: () => ({ outputs: {}, steps: [], checks: [] }),
  };
}

describe("compareKapsamId", () => {
  it("numaraları sayısal sıralar", () => {
    expect(["4.10", "4.2", "1.1", "4.1"].sort(compareKapsamId)).toEqual(["1.1", "4.1", "4.2", "4.10"]);
    expect(sortByKapsamId([{ id: "2.10" }, { id: "2.9" }]).map((c) => c.id)).toEqual(["2.9", "2.10"]);
  });
});

describe("standardAnchor", () => {
  it("standart numarasından ASCII bağlantı kimliği üretir", () => {
    expect(standardAnchor("IEC 60364-5-52")).toBe("std-iec-60364-5-52");
    expect(standardAnchor("IEC/TR 60890")).toBe("std-iec-tr-60890");
    expect(standardAnchor("Elektrik İç Tesisleri Yönetmeliği")).toBe("std-elektrik-ic-tesisleri-yonetmeligi");
  });
});

describe("groupReferencesByStandard", () => {
  it("referansları standarda göre gruplar, yazım farklarını birleştirir ve sıralar", () => {
    const groups = groupReferencesByStandard([
      calc("2.2", [{ standard: "IEC 60364-5-52", title: "Kablo sistemleri", clause: "Ek G" }]),
      calc("2.1", [{ standard: "iec  60364-5-52 " }, { standard: "IEC 60050" }]),
      calc("2.8", [{ standard: "IEC/TR 60890" }, { standard: "IEC TR 60890", clause: "Madde 5" }]),
      calc("1.4", [{ standard: "IEC 60050", clause: "131", note: "terminoloji" }]),
    ]);

    expect(groups.map((g) => g.standard)).toEqual(["IEC 60050", "IEC 60364-5-52", "IEC/TR 60890"]);
    expect(groups[2].usages).toHaveLength(2);
    const kablo = groups[1];
    expect(kablo.title).toBe("Kablo sistemleri");
    expect(kablo.anchor).toBe("std-iec-60364-5-52");
    expect(kablo.usages.map((u) => u.calc.id)).toEqual(["2.1", "2.2"]);
    expect(groups[0].usages.map((u) => u.calc.id)).toEqual(["1.4", "2.1"]);
  });

  it("referansı olmayan hesaplarda boş liste döner", () => {
    expect(groupReferencesByStandard([calc("1.2", [])])).toEqual([]);
  });
});

describe("referenceDetail", () => {
  it("madde ve notu birleştirir", () => {
    expect(referenceDetail({ standard: "X", clause: "Ek G", note: "Tablo G.1" })).toBe("Ek G · Tablo G.1");
    expect(referenceDetail({ standard: "X" })).toBeUndefined();
  });
});
