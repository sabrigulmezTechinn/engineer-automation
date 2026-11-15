/**
 * "otomasyon" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { donguYukDirenci } from "./dongu-yuk-direnci";
import { pidAyari } from "./pid-ayari";
import { rs485Modbus } from "./rs485-modbus";

export const OTOMASYON: CalcDefinition[] = [pidAyari, donguYukDirenci, rs485Modbus];
