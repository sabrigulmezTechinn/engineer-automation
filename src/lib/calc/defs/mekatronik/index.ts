/**
 * "mekatronik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { hidrolikSilindirPompa } from "./hidrolik-silindir-pompa";
import { pnomatikSilindir } from "./pnomatik-silindir";
import { vakumVantuz } from "./vakum-vantuz";

export const MEKATRONIK: CalcDefinition[] = [
  pnomatikSilindir,
  hidrolikSilindirPompa,
  vakumVantuz,
];
