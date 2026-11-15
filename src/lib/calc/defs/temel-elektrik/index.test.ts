/**
 * Temel elektrik kategorisinin ortak denetimi: girdi ve çıktı sembolleri KaTeX strict'ten geçer
 * (all-calcs.test.ts yalnız formülleri ve adımları denetler).
 */
import { describe, expect, it } from "vitest";
import { renderStrict } from "@/lib/calc/test-utils/katex";
import { TEMEL_ELEKTRIK } from "./index";

describe.each(TEMEL_ELEKTRIK.map((d) => [`${d.id} ${d.slug}`, d] as const))("%s", (_name, def) => {
  it("girdi ve çıktı sembolleri KaTeX strict'ten geçer", () => {
    for (const spec of [...def.inputs, ...def.outputs]) {
      if (spec.symbol !== undefined) expect(() => renderStrict(spec.symbol as string), `${spec.key}: ${spec.symbol}`).not.toThrow();
    }
  });
});
