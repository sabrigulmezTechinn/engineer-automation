"use client";
/**
 * cacheComponents açıkken Next.js, gezinmede önceki sayfayı kaldırmaz; React <Activity> ile gizler.
 * Bu yüzden `useActionState` sonuçları (başarı paneli, hata mesajları, gönderilen değerler) sayfaya
 * bağlantıyla geri dönüldüğünde hâlâ görünür. (bkz. node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md)
 *
 * `FormResetBoundary`: içindeki form GÖNDERİLDİYSE, sayfa gizlenirken alt ağacı yeniden oluşturur
 * (anahtarı değiştirir); sayfaya dönüldüğünde form temiz başlar. Gönderilmemiş taslaklar korunur.
 * Form bileşeni `useResetOnHide(state.status !== "idle")` ile gönderildiğini bildirir.
 */
import { createContext, Fragment, use, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const MarkSubmittedContext = createContext<((submitted: boolean) => void) | null>(null);

export function FormResetBoundary({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);
  const submitted = useRef(false);
  const markSubmitted = useCallback((value: boolean) => {
    submitted.current = value;
  }, []);

  useLayoutEffect(() => {
    // Activity sayfayı gizlediğinde (veya bileşen kaldırıldığında) çalışır.
    return () => {
      if (submitted.current) {
        submitted.current = false;
        setGeneration((g) => g + 1);
      }
    };
  }, []);

  return (
    <MarkSubmittedContext value={markSubmitted}>
      <Fragment key={generation}>{children}</Fragment>
    </MarkSubmittedContext>
  );
}

/** Form gönderildiyse (`submitted`) en yakın FormResetBoundary'ye bildirir. */
export function useResetOnHide(submitted: boolean) {
  const markSubmitted = use(MarkSubmittedContext);
  useLayoutEffect(() => {
    markSubmitted?.(submitted);
  }, [markSubmitted, submitted]);
}

/**
 * Her eylem sonucunda değişen bir anahtar döner. `<form key={...}>` ile kullanıldığında form, son
 * gönderilen değerleri `defaultValue` olarak alıp yeniden oluşturulur. Gerekçe: React 19 eylemden
 * sonra formu sıfırlar; `<select>` ise `defaultValue` değişikliğini yalnızca ilk oluşturulmada
 * uygular, yani sıfırlamada ilk değerine döner.
 */
export function useResultKey(state: unknown): number {
  const [key, setKey] = useState(0);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    // React'in önerdiği "önceki render'dan bilgi saklama" kalıbı.
    setLastState(state);
    setKey((k) => k + 1);
  }
  return key;
}
