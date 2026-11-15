/**
 * "elektronik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { buckBoostDonusturucu } from "./buck-boost-donusturucu";
import { sogutucuIsilHesap } from "./sogutucu-isil-hesap";
import { transistorBazDirenciMosfetKaybi } from "./transistor-baz-direnci-mosfet-kaybi";

export const ELEKTRONIK: CalcDefinition[] = [
  transistorBazDirenciMosfetKaybi,
  buckBoostDonusturucu,
  sogutucuIsilHesap,
];
