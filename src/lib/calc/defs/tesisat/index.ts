/**
 * "tesisat" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { kisaDevreAkimi } from "./kisa-devre-akimi";
import { topraklamaDirenci } from "./topraklama-direnci";

export const TESISAT: CalcDefinition[] = [kisaDevreAkimi, topraklamaDirenci];
