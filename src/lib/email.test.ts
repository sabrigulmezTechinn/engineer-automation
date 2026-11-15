import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dogrulamaEpostasi, extractLinks, sendEmail, sifreSifirlamaEpostasi } from "./email";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "dev-mail-birim-"));
  vi.stubEnv("DEV_MAIL_DIR", dir);
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("geliştirme e-posta taşıyıcısı", () => {
  it("e-postayı JSON ve HTML olarak kaydeder, bağlantıları çıkarır ve konsola yazar", async () => {
    const url = "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fe-posta-dogrulandi";
    await sendEmail(dogrulamaEpostasi({ to: "Ayse@Example.com", ad: "Ayşe", url }));

    const files = (await readdir(dir)).sort();
    expect(files).toHaveLength(2);
    const jsonFile = files.find((f) => f.endsWith(".json"))!;
    expect(jsonFile).toMatch(/^\d{4}-\d{2}-\d{2}T.*_ayse@example\.com_[0-9a-f]{8}\.json$/);

    const saved = JSON.parse(await readFile(path.join(dir, jsonFile), "utf8"));
    expect(saved).toMatchObject({ to: "Ayse@Example.com", subject: "E-posta adresinizi doğrulayın", links: [url] });
    expect(saved.text).toContain("Merhaba Ayşe");
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining(url));
  });

  it("kullanıcı adını HTML'de kaçışlar", async () => {
    const mail = sifreSifirlamaEpostasi({ to: "a@b.co", ad: "<script>x</script>", url: "http://localhost:3000/x" });
    expect(mail.html).not.toContain("<script>x</script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});

describe("extractLinks", () => {
  it("metindeki bağlantıları sırasıyla, sondaki noktalama olmadan döner", () => {
    expect(extractLinks("Giriş: http://a.test/giris\nSıfırla: https://a.test/s?x=1.")).toEqual([
      "http://a.test/giris",
      "https://a.test/s?x=1",
    ]);
  });
});
