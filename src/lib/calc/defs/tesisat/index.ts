/**
 * "tesisat" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { kisaDevreAkimi } from "./kisa-devre-akimi";
import { kompanzasyon } from "./kompanzasyon";
import { panoIsiHesabi } from "./pano-isi-hesabi";
import { topraklamaDirenci } from "./topraklama-direnci";
import { trafoSecimiYuklenme } from "./trafo-secimi-yuklenme";

export const TESISAT: CalcDefinition[] = [kompanzasyon, kisaDevreAkimi, trafoSecimiYuklenme, topraklamaDirenci, panoIsiHesabi];
