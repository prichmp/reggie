import { describe, expect, it } from "vitest";
import { compileRegex, runRegex } from "../src/lib/runRegex";

describe("compileRegex", () => {
  it("always includes g and d flags", () => {
    const re = compileRegex("abc", "i");
    expect(re.flags).toContain("g");
    expect(re.flags).toContain("d");
    expect(re.flags).toContain("i");
  });

  it("does not duplicate flags", () => {
    const re = compileRegex("abc", "gd");
    const chars = re.flags.split("");
    expect(new Set(chars).size).toBe(chars.length);
  });

  it("throws on invalid regex", () => {
    expect(() => compileRegex("[", "")).toThrow();
  });
});

describe("runRegex", () => {
  it("enumerates all matches for a global pattern", () => {
    const re = compileRegex("\\d+", "");
    const matches = runRegex(re, "a1 b22 c333");
    expect(matches.map((m) => m.text)).toEqual(["1", "22", "333"]);
  });

  it("captures indexed groups with offsets", () => {
    const re = compileRegex("(\\w+)-(\\d+)", "");
    const [m] = runRegex(re, "foo-42");
    expect(m.text).toBe("foo-42");
    expect(m.groups).toHaveLength(2);
    expect(m.groups[0].text).toBe("foo");
    expect(m.groups[0].index).toBe(0);
    expect(m.groups[0].end).toBe(3);
    expect(m.groups[1].text).toBe("42");
    expect(m.groups[1].index).toBe(4);
    expect(m.groups[1].end).toBe(6);
  });

  it("captures named groups", () => {
    const re = compileRegex("(?<word>[a-z]+)", "");
    const [m] = runRegex(re, "hello");
    expect(m.groups[0].name).toBe("word");
    expect(m.groups[0].text).toBe("hello");
  });

  it("represents non-participating groups as null", () => {
    const re = compileRegex("(a)|(b)", "");
    const [first] = runRegex(re, "a");
    expect(first.groups[0].text).toBe("a");
    expect(first.groups[1].text).toBeNull();
    expect(first.groups[1].index).toBe(-1);
  });

  it("handles zero-width matches without infinite loops", () => {
    const re = compileRegex("\\b", "");
    const matches = runRegex(re, "hi there");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.end >= m.index)).toBe(true);
  });

  it("returns empty array for empty subject", () => {
    const re = compileRegex("\\d+", "");
    expect(runRegex(re, "")).toEqual([]);
  });
});
