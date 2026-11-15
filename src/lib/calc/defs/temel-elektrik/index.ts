/**
 * "temel-elektrik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { ohmYasasi } from "./ohm-yasasi";

export const TEMEL_ELEKTRIK: CalcDefinition[] = [ohmYasasi];
