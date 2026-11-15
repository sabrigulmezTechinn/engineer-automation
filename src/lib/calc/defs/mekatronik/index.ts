/**
 * "mekatronik" kategorisinin hesapları. Yeni hesap bu klasörde kendi dosyasında tanımlanır ve buraya eklenir;
 * kayıt defteri (registry.ts) bu listeyi okur. Sıra önemsiz, allCalcs KAPSAM numarasına göre sıralar.
 */
import type { CalcDefinition } from "../../types";
import { disliKayisKasnakOranlari } from "./disli-kayis-kasnak-oranlari";
import { hidrolikSilindirPompa } from "./hidrolik-silindir-pompa";
import { kremayerKonveyorGucu } from "./kremayer-konveyor-gucu";
import { pnomatikSilindir } from "./pnomatik-silindir-kuvveti-hava-tuketimi";
import { rulmanOmru } from "./rulman-omru";
import { servoBoyutlandirma } from "./servo-boyutlandirma";
import { stepMotor } from "./step-motor";
import { vakumVantuz } from "./vakum-vantuz-tutma-kuvveti";
import { vidaliMil } from "./vidali-mil";

export const MEKATRONIK: CalcDefinition[] = [
  disliKayisKasnakOranlari,
  vidaliMil,
  stepMotor,
  servoBoyutlandirma,
  kremayerKonveyorGucu,
  pnomatikSilindir,
  hidrolikSilindirPompa,
  vakumVantuz,
  rulmanOmru,
];
