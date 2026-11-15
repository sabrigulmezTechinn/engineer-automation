// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Formula, renderLatex } from "./formula";

afterEach(cleanup);

describe("renderLatex", () => {
  it("geçerli LaTeX'i KaTeX HTML'ine çevirir", () => {
    const html = renderLatex("V = I \\cdot R");
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("katex-display");
  });

  it("displayMode ile blok gösterim üretir", () => {
    expect(renderLatex("x^2", true)).toContain("katex-display");
  });

  it("çözümlenemeyen LaTeX için null döner, fırlatmaz", () => {
    expect(renderLatex("\\frac{1}{")).toBeNull();
  });

  it("Türkçe karakterli alt simgeleri işler", () => {
    expect(renderLatex("I_{\\text{kısa devre}}")).toContain("katex");
  });
});

describe("<Formula>", () => {
  it("satır içi formülü span içinde gösterir", () => {
    const { container } = render(<Formula latex="P = U \cdot I" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe("SPAN");
    expect(root.querySelector(".katex")).not.toBeNull();
    expect(root.querySelector(".katex-display")).toBeNull();
  });

  it("displayMode'da yatay kaydırmalı blok sarmalayıcı kullanır", () => {
    const { container } = render(<Formula latex="f_0 = \frac{1}{2\pi\sqrt{LC}}" displayMode />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe("DIV");
    expect(root.className).toContain("overflow-x-auto");
    expect(root.querySelector(".katex-display")).not.toBeNull();
  });

  it("hatalı LaTeX'te kaynağı olduğu gibi gösterir", () => {
    const { container } = render(<Formula latex="\frac{1}{" />);
    const code = container.querySelector("code[data-formula-error]");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("\\frac{1}{");
    expect(container.querySelector(".katex")).toBeNull();
  });

  it("bilinmeyen komutu kırmızıyla işaretleyip formülün geri kalanını gösterir", () => {
    const { container } = render(<Formula latex="\bilinmeyen x + 1" />);
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).toContain("\\bilinmeyen");
  });

  it("sunucuda (hook'suz) statik HTML olarak işlenir", () => {
    const html = renderToStaticMarkup(<Formula latex="E = P \cdot t" displayMode />);
    expect(html).toContain("katex-display");
    expect(html.startsWith("<div")).toBe(true);
  });
});
