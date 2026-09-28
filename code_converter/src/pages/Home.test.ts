import { describe, expect, it } from "vitest";
import { convert, type Language } from "./Home";

const languages: Language[] = ["json", "python", "java", "csharp", "javascript", "typescript"];
const jsonSource = `{
  "name": "Ada",
  "count": 3,
  "active": true,
  "nested": { "city": "London" },
  "items": [1, 2, 3],
  "emptyObject": {},
  "emptyArray": [],
  "nullable": null
}`;

function outputOf(source: string, from: Language, to: Language, mode: "literal" | "definition" = "literal") {
  const result = convert(source, from, to, mode);
  expect(result.error, `${from} -> ${to} conversion failed`).toBe("");
  expect(result.output).not.toBe("");
  return result.output;
}

function jsonOutput(source: string, from: Language) {
  return JSON.parse(outputOf(source, from, "json"));
}

describe("conversion engine", () => {
  it("converts JSON to every supported target language", () => {
    for (const language of languages) {
      const output = outputOf(jsonSource, "json", language);
      expect(output).toContain(language === "json" ? '"name": "Ada"' : "Ada");
    }
  });

  it("accepts every supported source language", () => {
    const sources: Record<Language, string> = {
      json: jsonSource,
      python: `data = {'name': 'Ada', 'active': True, 'items': [1, 2, 3]}`,
      java: `Map<String, Object> data = new HashMap<>();\ndata.put("name", "Ada");\ndata.put("active", true);\ndata.put("items", List.of(1, 2, 3));`,
      csharp: `var data = new { Name = "Ada", Active = true, Items = new[] { 1, 2, 3 } };`,
      javascript: `const data = { name: "Ada", active: true, items: [1, 2, 3] };`,
      typescript: `const data = { name: "Ada", active: true, items: [1, 2, 3] };`,
    };

    for (const language of languages) {
      expect(jsonOutput(sources[language], language)).toMatchObject({ name: "Ada", active: true, items: [1, 2, 3] });
    }
  });

  it("preserves nested objects and arrays", () => {
    const output = jsonOutput(jsonSource, "json");
    expect(output.nested).toEqual({ city: "London" });
    expect(output.items).toEqual([1, 2, 3]);
    expect(output.emptyObject).toEqual({});
    expect(output.emptyArray).toEqual([]);
  });

  it("preserves escaped strings and comment-like text inside strings", () => {
    const source = `{
      "url": "https://example.com/a//b",
      "hash": "#keep-this",
      "quote": "I'm ready",
      "line": "not // a comment"
    }`;
    expect(jsonOutput(source, "json")).toEqual({
      url: "https://example.com/a//b",
      hash: "#keep-this",
      quote: "I'm ready",
      line: "not // a comment",
    });
  });

  it("removes comments only outside strings", () => {
    const source = `const data = {
      url: 'https://example.com', // trailing comment
      hash: '#still-a-value', /* block comment */
      value: 42 # Python-style comment
    };`;
    expect(jsonOutput(source, "javascript")).toEqual({
      url: "https://example.com",
      hash: "#still-a-value",
      value: 42,
    });
  });

  it("supports single-quoted strings with apostrophes and escapes", () => {
    const source = `data = {'message': 'I\\'m ready', 'path': 'C:\\\\Temp'}`;
    expect(jsonOutput(source, "python")).toEqual({
      message: "I'm ready",
      path: "C:\\Temp",
    });
  });

  it("preserves null values in literal output", () => {
    expect(jsonOutput(jsonSource, "json").nullable).toBeNull();
    expect(outputOf(jsonSource, "json", "python")).toContain("None");
    expect(outputOf(jsonSource, "json", "csharp")).toContain("null");
  });

  it("reports malformed input without throwing", () => {
    const result = convert('{ "missing": }', "json", "python", "literal");
    expect(result.output).toBe("");
    expect(result.error).not.toBe("");
  });

  it("supports swap-style JSON/C# round trips", () => {
    const csharp = outputOf(jsonSource, "json", "csharp");
    expect(jsonOutput(csharp, "csharp")).toMatchObject({
      name: "Ada",
      nested: { city: "London" },
      items: [1, 2, 3],
    });
  });

  it("supports swap-style JSON/Java round trips", () => {
    const java = outputOf(jsonSource, "json", "java");
    expect(jsonOutput(java, "java")).toMatchObject({
      name: "Ada",
      nested: { city: "London" },
      items: [1, 2, 3],
    });
  });

  it("generates definitions with language-appropriate names and types", () => {
    const source = `{
      "first_name": "Ada",
      "postal-code": 123,
      "is_active": true,
      "friends": [{ "first_name": "Grace" }, { "first_name": "Linus" }],
      "mixed": [1, "two"],
      "nothing": null
    }`;

    const csharp = outputOf(source, "json", "csharp", "definition");
    expect(csharp).toContain("FirstName");
    expect(csharp).toContain("PostalCode");
    expect(csharp).toContain("bool IsActive");
    expect(csharp).toContain("Friends[] Friends");
    expect(csharp).toContain("object[] Mixed");
    expect(csharp).toContain("object? Nothing");

    const python = outputOf(source, "json", "python", "definition");
    expect(python).toContain("first_name:");
    expect(python).toContain("postal_code:");
    expect(python).not.toContain("FirstName:");

    const typescript = outputOf(source, "json", "typescript", "definition");
    expect(typescript).toContain("first_name: string;");
    expect(typescript).toContain("postalCode: number;");
  });
});
