/**
 * "motor" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { gucTorkDevir } from "./guc-tork-devir";
import { motorNominalAkimi } from "./motor-nominal-akimi";
import { motorVerimiEnerjiTasarrufu } from "./motor-verimi-enerji-tasarrufu";
import { vfdSecimiFrenlemeDirenci } from "./vfd-secimi-frenleme-direnci";
import { yolVermeAkimlari } from "./yol-verme-akimlari";

export const MOTOR: CalcDefinition[] = [
  gucTorkDevir,
  motorNominalAkimi,
  yolVermeAkimlari,
  vfdSecimiFrenlemeDirenci,
  motorVerimiEnerjiTasarrufu,
];
