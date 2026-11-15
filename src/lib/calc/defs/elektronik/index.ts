/**
 * "elektronik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { zamanlayici555 } from "./555-zamanlayici";
import { bataryaOmru } from "./batarya-omru";
import { filtreKesimFrekansi } from "./filtre-kesim-frekansi";
import { ledOnDirenci } from "./led-on-direnci";
import { lm317AyarliRegulator } from "./lm317-ayarli-regulator";
import { opAmpKazanci } from "./op-amp-kazanci";
import { rcRlZamanSabiti } from "./rc-rl-zaman-sabiti";

export const ELEKTRONIK: CalcDefinition[] = [
  ledOnDirenci,
  rcRlZamanSabiti,
  filtreKesimFrekansi,
  opAmpKazanci,
  zamanlayici555,
  lm317AyarliRegulator,
  bataryaOmru,
];
