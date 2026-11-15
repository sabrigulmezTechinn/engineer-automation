/**
 * "elektronik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { pcbYolGenisligi } from "./pcb-yol-genisligi";
import { renkSmdKondansatorKodlari } from "./renk-smd-kondansator-kodlari";

export const ELEKTRONIK: CalcDefinition[] = [
  renkSmdKondansatorKodlari,
  pcbYolGenisligi,
];
