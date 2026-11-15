/**
 * "tesisat" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { gerilimDusumu } from "./gerilim-dusumu";
import { kabloKesitiSecimi } from "./kablo-kesiti-secimi";
import { sigortaSalterSecimi } from "./sigorta-salter-secimi";

export const TESISAT: CalcDefinition[] = [kabloKesitiSecimi, gerilimDusumu, sigortaSalterSecimi];
