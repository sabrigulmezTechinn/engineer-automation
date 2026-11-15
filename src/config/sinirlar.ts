/**
 * Yönetmelik ve standart sınır değerleri (KAPSAM §5.4).
 * Bu değerler değişebilir; hesap kodunun içine gömülmez, buradan `ctx.limits` ile okunur.
 * Her değerin yanında kaynağı yazılır. Faz 1 ve sonrası hesaplar ihtiyaç duydukça alan ekler.
 */
export const LIMITS = {
  /** NAMUR NE 43: 4-20 mA sinyalinde geçerli ölçüm aralığı ve arıza bölgeleri (mA) */
  namurNe43: {
    olcumAlt: 3.8,
    olcumUst: 20.5,
    arizaAlt: 3.6,
    arizaUst: 21.0,
  },
} as const;

export type Limits = typeof LIMITS;
