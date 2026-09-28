# Syntax Lab

Syntax Lab is a browser-based converter for common JSON-like object and array data. It currently supports conversions between **JSON, Python, Java, C#, JavaScript, and TypeScript**.

> **Beta limitation:** Syntax Lab does not parse arbitrary full programs. It is designed for data-shaped snippets such as object literals, map assignments, and C# object initializers. It may not preserve language-specific semantics, formatting, or types in every case.

## Features

- Literal data conversion across six languages
- Definition generation for typed target languages
- C# object initializer and Java `Map.put` input support
- Nested objects and arrays
- Local conversion in the browser
- Copy-to-clipboard with a compatibility fallback

## Privacy

Conversion happens in the browser; pasted code is not sent to a conversion server by this application. The site currently loads its IBM Plex Mono and Space Grotesk fonts from Google Fonts, so the browser contacts Google to retrieve those font assets.

Do not paste secrets, credentials, private keys, or other sensitive material into any public website unless you have reviewed its deployment and analytics configuration.

## Supported input shapes

- JSON objects and arrays
- JSON-like JavaScript and TypeScript literals
- Python dictionary/list literals
- C# anonymous object initializers such as `new { Name = "Ada" }`
- Java `Map<String, Object>` declarations with `.put(...)` assignments

Comments outside strings are accepted for JSON-like, JavaScript, TypeScript, and Python-style inputs. String contents, URLs, hashes, and apostrophes are preserved where the supported syntax allows them.

## Known limitations

- This is not a general-purpose source-to-source compiler.
- Mixed-type arrays produce conservative `object`/unknown-like definitions.
- Type inference is based on the supplied data sample.
- Definition mode cannot produce native type declarations for JSON itself.
- Language-specific classes, functions, imports, expressions, dates, enums, and custom runtime types are not fully supported.
- Generated code should be reviewed before use in production.

## Local development

Requirements: Node.js 22+ and npm.

```bash
git clone https://github.com/TJ-Mothokho/Code-Converter.git
cd Code-Converter/code_converter
npm ci
npm run dev
```

Available checks:

```bash
npm run lint
npm run build
```

## Contributing

Issues and pull requests are welcome. When reporting a conversion problem, include the source language, target language, mode, and a minimal non-sensitive input that reproduces it.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
