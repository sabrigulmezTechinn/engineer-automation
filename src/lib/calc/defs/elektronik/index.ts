/**
 * "elektronik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { zamanlayici555 } from "./555-zamanlayici";
import { lm317AyarliRegulator } from "./lm317-ayarli-regulator";
import { opAmpKazanci } from "./op-amp-kazanci";

export const ELEKTRONIK: CalcDefinition[] = [
  opAmpKazanci,
  zamanlayici555,
  lm317AyarliRegulator,
];
