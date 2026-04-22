import { describe, expect, it } from "vitest";
import { tokenizeRegex } from "../src/lib/regexTokenizer";

describe("tokenizeRegex", () => {
  it("tokenizes a simple literal", () => {
    const tokens = tokenizeRegex("abc");
    expect(tokens).toHaveLength(3);
    expect(tokens.every((t) => t.kind === "literal")).toBe(true);
  });

  it("recognizes character classes as single spans", () => {
    const tokens = tokenizeRegex("[a-z0-9]");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("charclass");
    expect(tokens[0].text).toBe("[a-z0-9]");
  });

  it("handles escaped closing bracket inside character class", () => {
    const tokens = tokenizeRegex("[\\]]");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("charclass");
  });

  it("marks unterminated character classes as errors", () => {
    const tokens = tokenizeRegex("[abc");
    expect(tokens[0].kind).toBe("error");
  });

  it("recognizes named groups", () => {
    const tokens = tokenizeRegex("(?<word>abc)");
    const open = tokens.find((t) => t.kind === "group-open");
    expect(open?.text).toBe("(?<word>");
    expect(tokens.some((t) => t.kind === "group-close")).toBe(true);
  });

  it("recognizes non-capturing and lookaround groups", () => {
    for (const src of ["(?:a)", "(?=a)", "(?!a)", "(?<=a)", "(?<!a)"]) {
      const tokens = tokenizeRegex(src);
      const open = tokens.find((t) => t.kind === "group-open");
      expect(open?.text.startsWith("(?")).toBe(true);
    }
  });

  it("recognizes quantifiers including {n,m}", () => {
    const tokens = tokenizeRegex("a+b*c?d{2,5}");
    const quantifiers = tokens.filter((t) => t.kind === "quantifier").map((t) => t.text);
    expect(quantifiers).toEqual(["+", "*", "?", "{2,5}"]);
  });

  it("recognizes lazy quantifiers", () => {
    const tokens = tokenizeRegex("a+?");
    const q = tokens.find((t) => t.kind === "quantifier");
    expect(q?.text).toBe("+?");
  });

  it("recognizes anchors and alternation", () => {
    const tokens = tokenizeRegex("^a|b$");
    expect(tokens.filter((t) => t.kind === "anchor").map((t) => t.text)).toEqual(["^", "$"]);
    expect(tokens.find((t) => t.kind === "alternation")?.text).toBe("|");
  });

  it("recognizes escapes including \\d and \\k<name>", () => {
    const tokens = tokenizeRegex("\\d\\k<foo>");
    const escapes = tokens.filter((t) => t.kind === "escape").map((t) => t.text);
    expect(escapes).toEqual(["\\d", "\\k<foo>"]);
  });

  it("flags unbalanced open parenthesis as error", () => {
    const tokens = tokenizeRegex("(abc");
    expect(tokens[0].kind).toBe("error");
  });

  it("flags stray close parenthesis as error", () => {
    const tokens = tokenizeRegex("abc)");
    expect(tokens[tokens.length - 1].kind).toBe("error");
  });
});
