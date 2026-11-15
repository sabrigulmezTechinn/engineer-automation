import { describe, expect, it } from "vitest";
import { profileSchema } from "@/app/profil/_lib/validation";
import { userAdditionalFields } from "@/db/user-fields";
import { authErrorMessage, fieldErrorsOf } from "./form";
import { resetPasswordSchema, signInSchema, signUpSchema } from "./validation";

const gecerliKayit = {
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  password: "12345678",
  passwordConfirm: "12345678",
  company: "",
  jobTitle: "",
};

describe("kayıt formu doğrulaması", () => {
  it("geçerli girdiyi kabul eder (şirket ve unvan isteğe bağlı)", () => {
    expect(signUpSchema.safeParse(gecerliKayit).success).toBe(true);
  });

  it("hataları alan bazında Türkçe döner", () => {
    const r = signUpSchema.safeParse({
      ...gecerliKayit,
      name: "",
      email: "gecersiz",
      password: "1234567",
      passwordConfirm: "farkli",
    });
    expect(r.success).toBe(false);
    const errors = fieldErrorsOf(r.error!);
    expect(errors.name).toEqual(["Ad soyad gerekli."]);
    expect(errors.email).toEqual(["Geçerli bir e-posta adresi girin."]);
    expect(errors.password).toEqual(["Şifre en az 8 karakter olmalıdır."]);
    expect(errors.passwordConfirm).toEqual(["Şifreler eşleşmiyor."]);
  });

  it("boş e-posta ve boş şifre tekrarı için ayrı mesaj verir", () => {
    const errors = fieldErrorsOf(
      signUpSchema.safeParse({ ...gecerliKayit, email: "", passwordConfirm: "" }).error!,
    );
    expect(errors.email).toEqual(["E-posta adresi gerekli."]);
    expect(errors.passwordConfirm).toEqual(["Şifreyi tekrar girin."]);
  });
});

describe("giriş ve şifre sıfırlama doğrulaması", () => {
  it("giriş: e-posta ve şifre zorunlu", () => {
    const errors = fieldErrorsOf(signInSchema.safeParse({ email: "", password: "" }).error!);
    expect(errors.email).toEqual(["E-posta adresi gerekli."]);
    expect(errors.password).toEqual(["Şifre gerekli."]);
  });

  it("sıfırlama: token ve eşleşen şifreler gerekli", () => {
    const errors = fieldErrorsOf(
      resetPasswordSchema.safeParse({ token: "", password: "12345678", passwordConfirm: "87654321" }).error!,
    );
    expect(errors.token?.[0]).toContain("Sıfırlama bağlantısı geçersiz");
    expect(errors.passwordConfirm).toEqual(["Şifreler eşleşmiyor."]);
  });
});

describe("profil formu doğrulaması", () => {
  const gecerli = {
    name: "Ayşe",
    company: "",
    jobTitle: "",
    unitSystem: "imperial",
    decimals: "6",
    standardSet: "iec",
  };

  it("geçerli tercihleri dönüştürür", () => {
    const r = profileSchema.safeParse(gecerli);
    expect(r.success && r.data.decimals).toBe(6);
  });

  it.each(["7", "-1", "", "2.5", "abc"])("ondalık basamak %j reddedilir", (decimals) => {
    const r = profileSchema.safeParse({ ...gecerli, decimals });
    expect(fieldErrorsOf(r.error!).decimals).toEqual(["Ondalık basamak 0 ile 6 arasında bir tam sayı olmalıdır."]);
  });

  it("bilinmeyen birim sistemi ve standart setini reddeder", () => {
    const errors = fieldErrorsOf(profileSchema.safeParse({ ...gecerli, unitSystem: "x", standardSet: "y" }).error!);
    expect(errors.unitSystem).toEqual(["Bir birim sistemi seçin."]);
    expect(errors.standardSet).toEqual(["Bir standart seti seçin."]);
  });
});

describe("better-auth ek alan doğrulayıcıları", () => {
  const validate = (alan: keyof typeof userAdditionalFields, value: unknown) =>
    userAdditionalFields[alan].validator.input["~standard"].validate(value);

  it("geçerli değerleri kabul eder", () => {
    expect(validate("company", null)).not.toHaveProperty("issues");
    expect(validate("decimals", 0)).not.toHaveProperty("issues");
    expect(validate("unitSystem", "si")).not.toHaveProperty("issues");
  });

  it("geçersiz değerleri Türkçe mesajla reddeder", () => {
    const sonuc = validate("decimals", 7) as { issues: { message: string }[] };
    expect(sonuc.issues[0].message).toBe("Ondalık basamak en fazla 6 olabilir.");
    expect(validate("standardSet", "ansi")).toHaveProperty("issues");
  });
});

describe("authErrorMessage", () => {
  it("better-auth kodlarını Türkçeye çevirir", () => {
    expect(authErrorMessage({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } })).toBe("E-posta adresi veya şifre hatalı.");
    expect(authErrorMessage({ body: { code: "EMAIL_NOT_VERIFIED" } })).toContain("henüz doğrulanmadı");
  });

  it("doğrulama hatalarında doğrulayıcının mesajını kullanır", () => {
    expect(authErrorMessage({ body: { code: "VALIDATION_ERROR", message: "Geçersiz standart seti." } })).toBe(
      "Geçersiz standart seti.",
    );
  });

  it("bilinmeyen hatada genel mesaj verir", () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(authErrorMessage(new Error("bağlantı koptu"))).toContain("Beklenmeyen bir hata");
    } finally {
      console.error = original;
    }
  });
});
