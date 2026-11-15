/**
 * "yardimci" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { birimDonusturucu } from "./birim-donusturucu";
import { standartDegerSerileri } from "./standart-deger-serileri";

export const YARDIMCI: CalcDefinition[] = [birimDonusturucu, standartDegerSerileri];
