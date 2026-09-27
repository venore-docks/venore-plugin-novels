import { describe, expect, it } from "vitest";
import { normalizeLocalizedText, pickText, splitParagraphs } from "./localized-text";
import { slugify, isValidSlug } from "./slug";

describe("localized text", () => {
  it("cai pro idioma padrão e depois pro primeiro não vazio", () => {
    expect(pickText({ "pt-BR": "Olá", en: "Hi" }, "en", "pt-BR")).toBe("Hi");
    expect(pickText({ "pt-BR": "Olá", en: " " }, "en", "pt-BR")).toBe("Olá");
    expect(pickText({ es: "Hola" }, "en", "pt-BR")).toBe("Hola");
    expect(pickText(undefined, "en", "pt-BR")).toBe("");
  });

  it("separa parágrafos por linha em branco", () => {
    expect(splitParagraphs("Um.\nainda um.\n\n  Dois.  \n\n\n")).toEqual(["Um.\nainda um.", "Dois."]);
  });

  it("mantém só os idiomas da obra e remove vazios", () => {
    expect(normalizeLocalizedText({ "pt-BR": " a ", en: "", fr: "b" }, ["pt-BR", "en"])).toEqual({ "pt-BR": "a" });
  });

  it("slug", () => {
    expect(slugify("A Última Canção!")).toBe("a-ultima-cancao");
    expect(isValidSlug("a-ultima-cancao")).toBe(true);
    expect(isValidSlug("A b")).toBe(false);
  });
});
