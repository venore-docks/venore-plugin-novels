import { describe, expect, it } from "vitest";
import { validateCreateWorkInput } from "./validation";

describe("validateCreateWorkInput", () => {
  it("aceita entrada válida", () => {
    expect(validateCreateWorkInput({ title: "Obra", slug: "obra-1", defaultLocale: "pt-BR" })).toBeNull();
  });
  it("recusa título vazio, slug inválido e idioma desconhecido", () => {
    expect(validateCreateWorkInput({ title: " ", slug: "obra", defaultLocale: "pt-BR" })?.code).toBe("novels.invalid_title");
    expect(validateCreateWorkInput({ title: "Obra", slug: "Obra 1", defaultLocale: "pt-BR" })?.code).toBe("novels.invalid_slug");
    expect(validateCreateWorkInput({ title: "Obra", slug: "obra", defaultLocale: "xx" })?.code).toBe("novels.invalid_locale");
  });
});
