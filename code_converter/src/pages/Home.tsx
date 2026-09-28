import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Braces,
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  Eraser,
  FileCode2,
  Sparkles,
} from "lucide-react";

type Language = "json" | "python" | "java" | "csharp" | "javascript" | "typescript";
type Value = null | boolean | number | string | Value[] | { [key: string]: Value };
type ConversionMode = "literal" | "definition";

type LanguageOption = {
  id: Language;
  label: string;
  short: string;
  accent: string;
};

const languages: LanguageOption[] = [
  { id: "json", label: "JSON", short: "JSON", accent: "#a7f3d0" },
  { id: "python", label: "Python", short: "PY", accent: "#fbbf24" },
  { id: "java", label: "Java", short: "JV", accent: "#fb7185" },
  { id: "csharp", label: "C#", short: "C#", accent: "#c4b5fd" },
  { id: "javascript", label: "JavaScript", short: "JS", accent: "#fde047" },
  { id: "typescript", label: "TypeScript", short: "TS", accent: "#93c5fd" },
];

const sampleJson = `{
  "string": "Hello World",
  "integer": 42,
  "decimal": 3.14,
  "boolean": true,
  "nullValue": null,
  "array": [
    "Apple",
    "Banana",
    "Orange"
  ],
  "object": {
    "name": "Raf",
    "age": 24
  }
}`;

function getLanguage(id: Language) {
  return languages.find((language) => language.id === id) ?? languages[0];
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1")
    .replace(/(^|\s)#.*$/gm, "$1");
}

function findMatching(source: string, start: number, open: string, close: string) {
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === open) depth += 1;
    if (character === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitTopLevel(source: string, delimiter = ",") {
  const parts: string[] = [];
  let start = 0;
  let curly = 0;
  let square = 0;
  let round = 0;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "{") curly += 1;
    else if (character === "}") curly -= 1;
    else if (character === "[") square += 1;
    else if (character === "]") square -= 1;
    else if (character === "(") round += 1;
    else if (character === ")") round -= 1;
    else if (character === delimiter && curly === 0 && square === 0 && round === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const finalPart = source.slice(start).trim();
  if (finalPart) parts.push(finalPart);
  return parts;
}

function quoteBareKeys(source: string) {
  return source.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
}

function parseJsonLike(source: string, language: Language): Value {
  let normalized = stripComments(source).trim();
  normalized = normalized.replace(/^\s*(?:const|let|var)\s+\w+\s*=\s*/i, "");
  normalized = normalized.replace(/^\s*data\s*=\s*/i, "");
  normalized = normalized.replace(/;\s*$/, "").trim();
  normalized = normalized.replace(/\bundefined\b/g, "null");
  normalized = normalized.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
  normalized = normalized.replace(/,\s*([}\]])/g, "$1");
  normalized = quoteBareKeys(normalized);
  if (language === "python" || language === "javascript" || language === "typescript") {
    normalized = normalized.replace(/'/g, '"');
  }
  return JSON.parse(normalized) as Value;
}

function parseCSharpValue(source: string): Value {
  const value = source.trim().replace(/;$/, "");
  if (/^new\s*\{/i.test(value)) {
    const open = value.indexOf("{");
    const close = findMatching(value, open, "{", "}");
    return parseCSharpObject(value.slice(open + 1, close));
  }
  if (/^new\s*\[\]/i.test(value)) {
    const open = value.indexOf("{");
    const close = findMatching(value, open, "{", "}");
    return splitTopLevel(value.slice(open + 1, close)).map(parseCSharpValue);
  }
  if (/null/i.test(value)) return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (/^["']/.test(value)) return value.replace(/^['"]|['"]$/g, "");
  const numberValue = Number(value.replace(/[fFdDmM]$/, ""));
  if (!Number.isNaN(numberValue)) return numberValue;
  return value;
}

function pascalToCamel(value: string) {
  return value.length ? value[0].toLowerCase() + value.slice(1) : value;
}

function parseCSharpObject(body: string): Value {
  const result: Record<string, Value> = {};
  for (const member of splitTopLevel(body)) {
    const separator = member.indexOf("=");
    if (separator < 0) continue;
    const key = member.slice(0, separator).trim().replace(/\s+$/, "");
    result[pascalToCamel(key)] = parseCSharpValue(member.slice(separator + 1));
  }
  return result;
}

function parseCSharp(source: string): Value {
  const objectStart = source.search(/\bnew\s*\{/i);
  if (objectStart < 0) throw new Error("Could not find a C# object initializer.");
  const open = source.indexOf("{", objectStart);
  const close = findMatching(source, open, "{", "}");
  if (close < 0) throw new Error("The C# object initializer is incomplete.");
  return parseCSharpObject(source.slice(open + 1, close));
}

function parseJavaValue(source: string, maps: Record<string, Value>): Value {
  const value = source.trim();
  if (/^List\.of\s*\(/i.test(value)) {
    const open = value.indexOf("(");
    const close = findMatching(value, open, "(", ")");
    return splitTopLevel(value.slice(open + 1, close)).map((item) => parseJavaValue(item, maps));
  }
  if (maps[value]) return maps[value];
  if (/^null$/i.test(value)) return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (/^["']/.test(value)) return value.replace(/^['"]|['"]$/g, "");
  const numberValue = Number(value.replace(/[fFdD]$/, ""));
  if (!Number.isNaN(numberValue)) return numberValue;
  return value;
}

function parseJava(source: string): Value {
  const maps: Record<string, Value> = {};
  const mapDeclarations = Array.from(source.matchAll(/Map<[^>]+>\s+(\w+)\s*=\s*new\s+HashMap<>\(\)\s*;/g));
  for (const declaration of mapDeclarations) maps[declaration[1]] = {};

  const putPattern = /(\w+)\.put\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = putPattern.exec(source))) {
    const open = source.indexOf("(", match.index);
    const close = findMatching(source, open, "(", ")");
    if (close < 0) continue;
    const args = splitTopLevel(source.slice(open + 1, close));
    if (args.length < 2) continue;
    const key = args[0].trim().replace(/^['"]|['"]$/g, "");
    const target = maps[match[1]] as Record<string, Value> | undefined;
    if (target) target[key] = parseJavaValue(args.slice(1).join(", "), maps);
    putPattern.lastIndex = close + 1;
  }
  if (maps.data) return maps.data;
  const data: Record<string, Value> = {};
  if (!Object.keys(data).length) throw new Error("Could not find Java map assignments.");
  return data;
}

function parseSource(source: string, language: Language): Value {
  switch (language) {
    case "csharp":
      return parseCSharp(source);
    case "java":
      return parseJava(source);
    default:
      return parseJsonLike(source, language);
  }
}

function indent(level: number) {
  return "    ".repeat(level);
}

function escapeString(value: string) {
  return JSON.stringify(value);
}

function pascalCase(value: string) {
  return value
    .replace(/^[^a-zA-Z]+/, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("") || "Value";
}

function serializeJson(value: Value) {
  return JSON.stringify(value, null, 2);
}

function serializePython(value: Value, level = 0): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number" || typeof value === "string") return typeof value === "string" ? escapeString(value) : String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value.map((item) => `${indent(level + 1)}${serializePython(item, level + 1)}`).join(",\n")}\n${indent(level)}]`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  return `{\n${entries.map(([key, item]) => `${indent(level + 1)}${escapeString(key)}: ${serializePython(item, level + 1)}`).join(",\n")}\n${indent(level)}}`;
}

function serializeJavaScript(value: Value, level = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return escapeString(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value.map((item) => `${indent(level + 1)}${serializeJavaScript(item, level + 1)}`).join(",\n")}\n${indent(level)}]`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  return `{\n${entries.map(([key, item]) => `${indent(level + 1)}${/^[A-Za-z_$][\w$]*$/.test(key) ? key : escapeString(key)}: ${serializeJavaScript(item, level + 1)}`).join(",\n")}\n${indent(level)}}`;
}

function serializeCSharp(value: Value, level = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return escapeString(value);
  if (Array.isArray(value)) {
    if (!value.length) return "Array.Empty<object>()";
    return `new[]\n${indent(level)}{\n${value.map((item) => `${indent(level + 1)}${serializeCSharp(item, level + 1)}`).join(",\n")}\n${indent(level)}}`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "new { }";
  return `new\n${indent(level)}{\n${entries.map(([key, item]) => `${indent(level + 1)}${pascalCase(key)} = ${serializeCSharp(item, level + 1)}`).join(",\n\n")}\n${indent(level)}}`;
}

function serializeJava(value: Value, name = "data", level = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return escapeString(value);
  if (Array.isArray(value)) {
    if (!value.length) return "List.of()";
    return `List.of(\n${value.map((item) => `${indent(level + 1)}${serializeJava(item, name, level + 1)}`).join(",\n")}\n${indent(level)})`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "Map.of()";
  return entries.map(([key, item]) => `${indent(level)}${name}.put(${escapeString(key)}, ${serializeJava(item, name, level)});`).join("\n");
}

function serialize(value: Value, language: Language) {
  switch (language) {
    case "json":
      return serializeJson(value);
    case "python":
      return `data = ${serializePython(value)}`;
    case "javascript":
      return `const data = ${serializeJavaScript(value)};`;
    case "typescript":
      return `const data = ${serializeJavaScript(value)};`;
    case "csharp":
      return `var data = ${serializeCSharp(value)};`;
    case "java": {
      if (!value || Array.isArray(value) || typeof value !== "object") return `Object data = ${serializeJava(value)};`;
      const entries = Object.entries(value);
      const lines = [`Map<String, Object> data = new HashMap<>();`];
      for (const [key, item] of entries) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const nested = `${pascalCase(key)}Map`;
          lines.push(`\nMap<String, Object> ${nested} = new HashMap<>();`);
          for (const [nestedKey, nestedValue] of Object.entries(item)) {
            lines.push(`\n${nested}.put(${escapeString(nestedKey)}, ${serializeJava(nestedValue)});`);
          }
          lines.push(`\ndata.put(${escapeString(key)}, ${nested});`);
        } else {
          lines.push(`\ndata.put(${escapeString(key)}, ${serializeJava(item)});`);
        }
      }
      return lines.join("");
    }
  }
}

type DefinitionField = { key: string; value: Value; type: string };
type DefinitionNode = { name: string; fields: DefinitionField[] };

function isObject(value: Value): value is { [key: string]: Value } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectDefinitions(value: Value, name: string, definitions: DefinitionNode[]) {
  if (!isObject(value)) return;
  const fields: DefinitionField[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (isObject(item)) {
      const nestedName = pascalCase(key);
      collectDefinitions(item, nestedName, definitions);
      fields.push({ key, value: item, type: nestedName });
    } else if (Array.isArray(item)) {
      const sample: Value = item.find((entry) => entry !== null && entry !== undefined) ?? null;
      let itemType = "unknown";
      if (isObject(sample)) {
        const nestedName = pascalCase(key);
        collectDefinitions(sample, nestedName, definitions);
        itemType = nestedName;
      } else if (typeof sample === "string") itemType = "string";
      else if (typeof sample === "number") itemType = Number.isInteger(sample) ? "int" : "double";
      else if (typeof sample === "boolean") itemType = "bool";
      fields.push({ key, value: item, type: `${itemType}[]` });
    } else if (typeof item === "string") fields.push({ key, value: item, type: "string" });
    else if (typeof item === "number") fields.push({ key, value: item, type: Number.isInteger(item) ? "int" : "double" });
    else if (typeof item === "boolean") fields.push({ key, value: item, type: "bool" });
    else fields.push({ key, value: item, type: "string?" });
  }
  definitions.push({ name, fields });
}

function definitionType(field: DefinitionField, language: Language) {
  const nullable = field.value === null;
  const type = field.type;
  if (language === "csharp") {
    const mapped = type === "int" ? "int" : type === "double" ? "double" : type === "bool" ? "bool" : type === "string" ? "string" : type;
    return nullable ? "string?" : mapped;
  }
  if (language === "java") {
    const mapped = type === "int" ? "int" : type === "double" ? "double" : type === "bool" ? "boolean" : type === "string" ? "String" : type;
    return mapped.endsWith("[]") ? `List<${mapped.slice(0, -2)}>` : mapped;
  }
  if (language === "python") {
    const mapped = type === "int" ? "int" : type === "double" ? "float" : type === "bool" ? "bool" : type === "string" ? "str" : type;
    return nullable ? `${mapped} | None` : mapped.replace(/\[\]$/, (match) => `list[${mapped.slice(0, -match.length)}]`);
  }
  if (language === "typescript") {
    const mapped = type === "int" || type === "double" ? "number" : type === "bool" ? "boolean" : type === "string" ? "string" : type.replace(/\[\]$/, "[]");
    return nullable ? `${mapped} | null` : mapped;
  }
  if (language === "javascript") {
    const mapped = type === "int" || type === "double" ? "number" : type === "bool" ? "boolean" : type === "string" ? "string" : type.replace(/\[\]$/, "[]");
    return nullable ? `${mapped}|null` : mapped;
  }
  return type;
}

function serializeDefinitions(value: Value, language: Language) {
  if (!isObject(value)) return "Definition mode expects an object at the root.";
  const definitions: DefinitionNode[] = [];
  collectDefinitions(value, "Person", definitions);
  if (language === "json") return "JSON has no native class or type declarations. Choose a typed target language for definitions.";
  if (language === "csharp") return definitions.map((definition) => `public class ${definition.name}\n{\n${definition.fields.map((field) => `    public ${definitionType(field, language)} ${pascalCase(field.key)} { get; set; }`).join("\n")}\n}`).join("\n\n");
  if (language === "java") return definitions.map((definition) => `public class ${definition.name}\n{\n${definition.fields.map((field) => `    private ${definitionType(field, language)} ${pascalCase(field.key)};`).join("\n")}\n}`).join("\n\n");
  if (language === "python") return definitions.map((definition) => `class ${definition.name}:\n${definition.fields.map((field) => `    ${pascalCase(field.key)}: ${definitionType(field, language)}`).join("\n")}`).join("\n\n");
  if (language === "javascript") return definitions.map((definition) => `/**\n * @typedef {Object} ${definition.name}\n${definition.fields.map((field) => ` * @property {${definitionType(field, language)}} ${pascalCase(field.key)}`).join("\n")}\n */`).reverse().join("\n\n");
  return definitions.map((definition) => `interface ${definition.name} {\n${definition.fields.map((field) => `    ${pascalCase(field.key)}: ${definitionType(field, language)};`).join("\n")}\n}`).join("\n\n");
}

function convert(source: string, from: Language, to: Language, mode: ConversionMode) {
  if (!source.trim()) return { output: "", error: "" };
  try {
    const value = parseSource(source, from);
    return { output: mode === "definition" ? serializeDefinitions(value, to) : serialize(value, to), error: "" };
  } catch (error) {
    return {
      output: "",
      error: error instanceof Error ? error.message : "We couldn't parse that code yet.",
    };
  }
}

function LineNumbers({ value }: { value: string }) {
  const count = Math.max(1, value.split("\n").length);
  return (
    <div className="line-numbers" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}
    </div>
  );
}

function LanguageSelect({ value, onChange, label }: { value: Language; onChange: (value: Language) => void; label: string }) {
  const language = getLanguage(value);
  return (
    <label className="language-select">
      <span className="sr-only">{label}</span>
      <span className="language-dot" style={{ backgroundColor: language.accent }} />
      <select value={value} onChange={(event) => onChange(event.target.value as Language)} aria-label={label}>
        {languages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" />
    </label>
  );
}

export default function Home() {
  const [from, setFrom] = useState<Language>("json");
  const [to, setTo] = useState<Language>("csharp");
  const [source, setSource] = useState(sampleJson);
  const [mode, setMode] = useState<ConversionMode>("literal");
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => convert(source, from, to, mode), [source, from, to, mode]);
  const sourceLanguage = getLanguage(from);
  const targetLanguage = getLanguage(to);
  const inputLines = source.split("\n").length;
  const outputLines = result.output ? result.output.split("\n").length : 0;

  function handleSwap() {
    setFrom(to);
    setTo(from);
    setSource(result.output || source);
    setCopied(false);
  }

  function handleModeChange(nextMode: ConversionMode) {
    setMode(nextMode);
    setCopied(false);
  }

  async function handleCopy() {
    if (!result.output) return;
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function loadSample(language: Language) {
    setFrom(language);
    setTo(language === "json" ? "python" : "json");
    setSource(language === "json" ? sampleJson : serialize(parseSource(sampleJson, "json"), language));
    setCopied(false);
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Code2 size={18} strokeWidth={2.3} /></div>
          <span className="brand-name">syntax<span>/</span>lab</span>
        </div>
        <div className="topbar-meta">
          <span className="local-pill"><span className="pulse-dot" /> Runs locally in your browser</span>
          <span className="version-label">v1.0</span>
        </div>
      </header>

      <section className="intro-section">
        <div className="eyebrow"><Sparkles size={14} /> DEVELOPER TOOLKIT <span className="eyebrow-rule" /></div>
        <h1>Translate code.<br /><em>Keep the logic.</em></h1>
        <p className="intro-copy">Move between the languages you use every day.<br />Paste once, shape the output, ship faster.</p>
      </section>

      <section className="workspace" aria-label="Code converter">
        <div className="workspace-toolbar">
          <div className="flow-label"><span className="toolbar-kicker">CONVERT</span><span className="flow-language">{sourceLanguage.label}</span><ArrowRight size={16} /><span className="flow-language">{targetLanguage.label}</span></div>
          <div className="toolbar-actions">
            <div className="mode-switch" role="group" aria-label="Output mode">
              <button className={mode === "literal" ? "active" : ""} type="button" onClick={() => handleModeChange("literal")}><Braces size={14} /> Literal</button>
              <button className={mode === "definition" ? "active" : ""} type="button" onClick={() => handleModeChange("definition")}><FileCode2 size={14} /> Definition</button>
            </div>
            <button className="text-button" type="button" onClick={() => { setSource(""); setCopied(false); }}><Eraser size={15} /> Clear</button>
            <button className="swap-button" type="button" onClick={handleSwap} aria-label="Swap source and target languages"><ArrowRightLeft size={15} /> Swap</button>
          </div>
        </div>

        <div className="editor-grid">
          <article className="editor-card input-card">
            <div className="editor-card-header">
              <div className="panel-heading"><span className="panel-index">01</span><div><p className="panel-label">SOURCE</p><LanguageSelect value={from} onChange={(value) => { setFrom(value); setCopied(false); }} label="Source language" /></div></div>
              <span className="char-count">{source.length.toLocaleString()} chars</span>
            </div>
            <div className="code-surface input-surface">
              <LineNumbers value={source} />
              <textarea value={source} onChange={(event) => { setSource(event.target.value); setCopied(false); }} spellCheck={false} aria-label="Source code" placeholder="Paste your code here..." />
            </div>
            <div className="editor-footer"><span><FileCode2 size={14} /> {inputLines} lines</span><span className="format-hint">Accepts {sourceLanguage.label}</span></div>
          </article>

          <div className="conversion-rail" aria-hidden="true"><div className="rail-line" /><div className="rail-icon"><ArrowRight size={17} /></div><div className="rail-line" /></div>

          <article className="editor-card output-card">
            <div className="editor-card-header">
              <div className="panel-heading"><span className="panel-index output-index">02</span><div><p className="panel-label">OUTPUT</p><LanguageSelect value={to} onChange={(value) => { setTo(value); setCopied(false); }} label="Target language" /></div></div>
              <button className={`copy-button ${copied ? "is-copied" : ""}`} type="button" onClick={handleCopy} disabled={!result.output}>{copied ? <><Check size={15} /> Copied</> : <><Clipboard size={15} /> Copy output</>}</button>
            </div>
            <div className={`code-surface output-surface ${result.error ? "has-error" : ""}`}>
              {result.error ? <div className="error-state"><div className="error-icon">!</div><p>We couldn't parse that yet.</p><span>{result.error}</span><small>Try a complete {sourceLanguage.label} object or load a sample below.</small></div> : result.output ? <><div className="line-numbers output-lines" aria-hidden="true">{Array.from({ length: outputLines }, (_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div><pre aria-label="Converted code"><code>{result.output}</code></pre></> : <div className="empty-state"><div className="empty-glyph">↗</div><p>Your converted code will appear here.</p><span>Choose a target language, then paste code on the left.</span></div>}
            </div>
            <div className="editor-footer"><span><span className={`status-dot ${result.error ? "error-dot" : ""}`} /> {result.error ? "Needs attention" : "Ready to copy"}</span><span className="format-hint">Output: {targetLanguage.label}</span></div>
          </article>
        </div>
      </section>

      <section className="sample-section">
        <div><p className="sample-kicker">QUICK START</p><h2>Try a sample</h2></div>
        <div className="sample-actions">{languages.map((language) => <button key={language.id} type="button" onClick={() => loadSample(language.id)}><span style={{ color: language.accent }}>{language.short}</span>{language.label}</button>)}</div>
      </section>

      <footer className="footer"><span>Built for the in-between moments.</span><span>JSON · PY · JAVA · C# · JS · TS</span></footer>
    </main>
  );
}
