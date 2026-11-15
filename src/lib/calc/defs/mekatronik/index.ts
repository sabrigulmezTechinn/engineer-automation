/**
 * "mekatronik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { disliKayisKasnakOranlari } from "./disli-kayis-kasnak-oranlari";
import { kremayerKonveyorGucu } from "./kremayer-konveyor-gucu";
import { servoBoyutlandirma } from "./servo-boyutlandirma";
import { stepMotor } from "./step-motor";
import { vidaliMil } from "./vidali-mil";

export const MEKATRONIK: CalcDefinition[] = [
  disliKayisKasnakOranlari,
  vidaliMil,
  stepMotor,
  servoBoyutlandirma,
  kremayerKonveyorGucu,
];
