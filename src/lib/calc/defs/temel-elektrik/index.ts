/**
 * "temel-elektrik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { acGuc } from "./ac-guc";
import { dbDonusumleri } from "./db-donusumleri";
import { enerjiMaliyeti } from "./enerji-tuketimi-maliyet";
import { gerilimAkimBolucu } from "./gerilim-akim-bolucu";
import { ohmYasasi } from "./ohm-yasasi";
import { reaktansEmpedansRezonans } from "./reaktans-empedans-rezonans";
import { seriParalel } from "./seri-paralel";

export const TEMEL_ELEKTRIK: CalcDefinition[] = [
  ohmYasasi,
  seriParalel,
  gerilimAkimBolucu,
  acGuc,
  reaktansEmpedansRezonans,
  enerjiMaliyeti,
  dbDonusumleri,
];
