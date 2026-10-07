import { describe, expect, it } from "vitest";
import { validateCreateWorkInput } from "./validation";

describe("validateCreateWorkInput", () => {
  it("aceita entrada válida", () => {
    expect(validateCreateWorkInput({ title: "Obra", slug: "obra-1", defaultLocale: "pt-BR" })).toBeNull();
    expect(
      validateCreateWorkInput({ title: "Obra", slug: "obra", defaultLocale: "en", locales: ["en", "pt-BR"], coverFocus: { x: 10, y: 90 } }),
    ).toBeNull();
  });
  it("recusa título vazio, slug inválido e idioma desconhecido", () => {
    expect(validateCreateWorkInput({ title: " ", slug: "obra", defaultLocale: "pt-BR" })?.code).toBe("novels.invalid_title");
    expect(validateCreateWorkInput({ title: "Obra", slug: "Obra 1", defaultLocale: "pt-BR" })?.code).toBe("novels.invalid_slug");
    expect(validateCreateWorkInput({ title: "Obra", slug: "obra", defaultLocale: "xx" })?.code).toBe("novels.invalid_locale");
  });
  it("recusa idioma principal fora da lista e recorte fora de 0–100", () => {
    expect(validateCreateWorkInput({ title: "Obra", slug: "obra", defaultLocale: "en", locales: ["pt-BR"] })?.code).toBe("novels.invalid_locale");
    expect(validateCreateWorkInput({ title: "Obra", slug: "obra", defaultLocale: "pt-BR", coverFocus: { x: 120, y: 0 } })?.code).toBe(
      "novels.invalid_cover_focus",
    );
  });
});
