/**
 * "otomasyon" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { analogOlcekleme } from "./analog-olcekleme";
import { enkoder } from "./enkoder";
import { pt100Termokupl } from "./pt100-termokupl";
import { gucKaynagi24Vdc } from "./guc-kaynagi-24vdc";

export const OTOMASYON: CalcDefinition[] = [
  analogOlcekleme,
  enkoder,
  pt100Termokupl,
  gucKaynagi24Vdc,
];
