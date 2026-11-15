import { describe, expect, it } from "vitest";
import type { NumberInputSpec } from "@/lib/calc/types";
import { allowsNegative, toggleSign } from "./calc-form";

const spec = (over: Partial<NumberInputSpec> = {}): NumberInputSpec => ({
  kind: "number",
  key: "x",
  label: "X",
  dimension: "gerilim",
  defaultUnit: "V",
  ...over,
});

describe("± düğmesi", () => {
  it("işareti ekler ve kaldırır", () => {
    expect(toggleSign("12")).toBe("-12");
    expect(toggleSign("-12")).toBe("12");
    expect(toggleSign("−1,5")).toBe("1,5");
    expect(toggleSign("+3")).toBe("-3");
    expect(toggleSign(" 4 ")).toBe("-4");
    expect(toggleSign("")).toBe("-");
    expect(toggleSign("-")).toBe("");
  });

  it("yalnızca negatif değer alabilen girdilerde gösterilir", () => {
    expect(allowsNegative(spec())).toBe(true);
    expect(allowsNegative(spec({ min: -273.15 }))).toBe(true);
    expect(allowsNegative(spec({ min: 0 }))).toBe(false);
    expect(allowsNegative(spec({ min: 0, minExclusive: true }))).toBe(false);
  });
});
