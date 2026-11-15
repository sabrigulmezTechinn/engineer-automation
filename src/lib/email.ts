/**
 * E-posta gönderimi.
 *
 * Şimdilik yalnızca GELİŞTİRME taşıyıcısı var: e-posta gönderilmez; sunucu konsoluna yazılır ve
 * `.dev-mail/` klasörüne (veya DEV_MAIL_DIR) zaman damgalı .json + .html dosyası olarak kaydedilir.
 * Uçtan uca testler doğrulama / şifre sıfırlama bağlantısını bu JSON dosyasındaki `links`
 * alanından okuyabilir.
 *
 * TODO: Gerçek SMTP / e-posta sağlayıcısı (ör. nodemailer + SMTP ya da bir HTTP API'si) sonra
 * eklenecek. `sendEmail` imzası aynı kalacak; yalnızca taşıyıcı seçimi değişecek.
 * (nodemailer şu an kurulu değil.)
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Geliştirme e-postalarının yazıldığı klasör */
export function devMailDir(): string {
  const ozelKlasor = process.env.DEV_MAIL_DIR;
  // turbopackIgnore: dinamik yol, derlemede tüm projenin sunucu çıktısına izlenmesine yol açmasın.
  if (ozelKlasor) return path.resolve(/* turbopackIgnore: true */ ozelKlasor);
  return path.join(process.cwd(), ".dev-mail");
}

/** Metindeki http(s) bağlantılarını sırasıyla çıkarır (testlerin kolayca okuyabilmesi için). */
export function extractLinks(text: string): string[] {
  // Cümle sonundaki noktalama bağlantıya dahil edilmez.
  return Array.from(text.matchAll(/https?:\/\/[^\s<>"')]+/g), (m) => m[0].replace(/[.,;:!?]+$/, ""));
}

let productionWarningShown = false;

/** Geliştirme taşıyıcısı: konsola yazar ve dosyaya kaydeder. Kaydedilen JSON dosyasının yolunu döner. */
async function devTransport(message: EmailMessage): Promise<string> {
  if (process.env.NODE_ENV === "production" && !productionWarningShown) {
    productionWarningShown = true;
    console.warn(
      "[e-posta] UYARI: Gerçek e-posta sağlayıcısı yapılandırılmadı; e-postalar yalnızca dosyaya yazılıyor.",
    );
  }

  const createdAt = new Date();
  const links = extractLinks(message.text);
  const dir = devMailDir();
  await mkdir(dir, { recursive: true });

  const recipient = message.to.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  const base = `${createdAt.toISOString().replace(/[:.]/g, "-")}_${recipient}_${randomUUID().slice(0, 8)}`;
  const jsonPath = path.join(dir, `${base}.json`);

  await writeFile(
    jsonPath,
    JSON.stringify({ ...message, links, createdAt: createdAt.toISOString() }, null, 2),
    "utf8",
  );
  await writeFile(path.join(dir, `${base}.html`), message.html, "utf8");

  console.info(
    [
      "",
      "──────── [e-posta: geliştirme] ────────",
      `Kime : ${message.to}`,
      `Konu : ${message.subject}`,
      ...links.map((l) => `Bağlantı: ${l}`),
      `Dosya: ${jsonPath}`,
      "───────────────────────────────────────",
    ].join("\n"),
  );
  return jsonPath;
}

/** E-posta gönderir. Şimdilik geliştirme taşıyıcısını kullanır. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  await devTransport(message);
}

/* ------------------------------------------------------------------------------------------------
 * Şablonlar (Türkçe)
 * ---------------------------------------------------------------------------------------------- */

const SITE_ADI = "Mühendislik Hesaplama Platformu";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlSablon(baslik: string, paragraflar: string[], dugme?: { metin: string; url: string }) {
  const govde = paragraflar.map((p) => `<p style="margin:0 0 16px">${p}</p>`).join("\n");
  const dugmeHtml = dugme
    ? `<p style="margin:24px 0">
  <a href="${escapeHtml(dugme.url)}" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(dugme.metin)}</a>
</p>
<p style="margin:0 0 16px;font-size:13px;color:#52525b">Düğme çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br><a href="${escapeHtml(dugme.url)}" style="color:#2563eb;word-break:break-all">${escapeHtml(dugme.url)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><title>${escapeHtml(baslik)}</title></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<h1 style="margin:0 0 24px;font-size:20px">${escapeHtml(baslik)}</h1>
${govde}
${dugmeHtml}
<p style="margin:32px 0 0;font-size:12px;color:#71717a">${SITE_ADI}</p>
</div>
</body>
</html>`;
}

/** Kayıt sonrası e-posta doğrulama bağlantısı */
export function dogrulamaEpostasi({ to, ad, url }: { to: string; ad: string; url: string }): EmailMessage {
  const subject = "E-posta adresinizi doğrulayın";
  const text = [
    `Merhaba ${ad},`,
    "",
    `${SITE_ADI} hesabınızı etkinleştirmek için aşağıdaki bağlantıyı açın:`,
    url,
    "",
    "Bağlantı 1 saat geçerlidir. Bu kaydı siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
  ].join("\n");
  const html = htmlSablon(
    subject,
    [
      `Merhaba ${escapeHtml(ad)},`,
      `${SITE_ADI} hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın.`,
      "Bağlantı 1 saat geçerlidir. Bu kaydı siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
    ],
    { metin: "E-postamı doğrula", url },
  );
  return { to, subject, text, html };
}

/** Şifre sıfırlama bağlantısı */
export function sifreSifirlamaEpostasi({ to, ad, url }: { to: string; ad: string; url: string }): EmailMessage {
  const subject = "Şifre sıfırlama isteği";
  const text = [
    `Merhaba ${ad},`,
    "",
    "Hesabınız için şifre sıfırlama isteği aldık. Yeni şifre belirlemek için aşağıdaki bağlantıyı açın:",
    url,
    "",
    "Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.",
  ].join("\n");
  const html = htmlSablon(
    subject,
    [
      `Merhaba ${escapeHtml(ad)},`,
      "Hesabınız için şifre sıfırlama isteği aldık. Yeni şifre belirlemek için aşağıdaki düğmeyi kullanın.",
      "Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.",
    ],
    { metin: "Yeni şifre belirle", url },
  );
  return { to, subject, text, html };
}

/**
 * Kayıtlı bir e-posta ile tekrar kayıt denendiğinde gönderilir. (E-posta numaralandırmasını
 * önlemek için kayıt formu her durumda aynı yanıtı verir; asıl bilgi bu e-postayla iletilir.)
 */
export function mevcutHesapEpostasi({
  to,
  ad,
  girisUrl,
  sifremiUnuttumUrl,
}: {
  to: string;
  ad: string;
  girisUrl: string;
  sifremiUnuttumUrl: string;
}): EmailMessage {
  const subject = "Bu e-posta ile zaten bir hesabınız var";
  const text = [
    `Merhaba ${ad},`,
    "",
    "Bu e-posta adresiyle yeni bir kayıt denendi, ancak adresinize ait bir hesap zaten var.",
    `Giriş yapmak için: ${girisUrl}`,
    `Şifrenizi hatırlamıyorsanız: ${sifremiUnuttumUrl}`,
    "",
    "Bu denemeyi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
  ].join("\n");
  const html = htmlSablon(
    subject,
    [
      `Merhaba ${escapeHtml(ad)},`,
      "Bu e-posta adresiyle yeni bir kayıt denendi, ancak adresinize ait bir hesap zaten var.",
      `Şifrenizi hatırlamıyorsanız <a href="${escapeHtml(sifremiUnuttumUrl)}" style="color:#2563eb">şifrenizi sıfırlayabilirsiniz</a>.`,
      "Bu denemeyi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
    ],
    { metin: "Giriş yap", url: girisUrl },
  );
  return { to, subject, text, html };
}
