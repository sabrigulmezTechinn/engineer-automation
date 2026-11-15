/**
 * "otomasyon" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { analogOlcekleme } from "./analog-olcekleme";
import { donguYukDirenci } from "./dongu-yuk-direnci";
import { enkoder } from "./enkoder";
import { gucKaynagi24Vdc } from "./guc-kaynagi-24vdc";
import { pidAyari } from "./pid-ayari";
import { pt100Termokupl } from "./pt100-termokupl";
import { rs485Modbus } from "./rs485-modbus";

export const OTOMASYON: CalcDefinition[] = [
  analogOlcekleme,
  enkoder,
  pt100Termokupl,
  gucKaynagi24Vdc,
  pidAyari,
  donguYukDirenci,
  rs485Modbus,
];
