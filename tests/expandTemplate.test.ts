import { describe, expect, it } from "vitest";
import { expandTemplate } from "../src/lib/expandTemplate";
import type { MatchResult } from "../src/types";

function makeMatch(partial: Partial<MatchResult>): MatchResult {
  return {
    index: 0,
    end: 0,
    text: "",
    groups: [],
    ...partial,
  };
}

describe("expandTemplate", () => {
  it("expands $& to the full match", () => {
    const m = makeMatch({ text: "hello" });
    expect(expandTemplate("[$&]", m)).toBe("[hello]");
  });

  it("expands $$ to a literal $", () => {
    const m = makeMatch({ text: "x" });
    expect(expandTemplate("$$5.00", m)).toBe("$5.00");
  });

  it("expands numbered backreferences", () => {
    const m = makeMatch({
      text: "foo-42",
      groups: [
        { index: 0, end: 3, text: "foo" },
        { index: 4, end: 6, text: "42" },
      ],
    });
    expect(expandTemplate("$1/$2", m)).toBe("foo/42");
  });

  it("expands named backreferences with $<name>", () => {
    const m = makeMatch({
      text: "hello",
      groups: [{ name: "word", index: 0, end: 5, text: "hello" }],
    });
    expect(expandTemplate("<$<word>>", m)).toBe("<hello>");
  });

  it("leaves unknown names as empty string", () => {
    const m = makeMatch({ text: "hi", groups: [] });
    expect(expandTemplate("[$<missing>]", m)).toBe("[]");
  });

  it("treats unterminated $< as literal", () => {
    const m = makeMatch({ text: "hi" });
    expect(expandTemplate("$<abc", m)).toBe("$<abc");
  });

  it("renders null groups as empty string", () => {
    const m = makeMatch({
      text: "a",
      groups: [{ index: -1, end: -1, text: null }],
    });
    expect(expandTemplate("[$1]", m)).toBe("[]");
  });

  it("does not support $` or $' (backtick/apostrophe)", () => {
    const m = makeMatch({ text: "x" });
    expect(expandTemplate("$`", m)).toBe("$`");
    expect(expandTemplate("$'", m)).toBe("$'");
  });

  it("prefers two-digit group index when it exists", () => {
    const groups = Array.from({ length: 12 }, (_, i) => ({
      index: i,
      end: i + 1,
      text: `g${i + 1}`,
    }));
    const m = makeMatch({ text: "x", groups });
    expect(expandTemplate("$12", m)).toBe("g12");
  });

  it("expands \\n, \\r, \\t to newline/carriage-return/tab", () => {
    const m = makeMatch({ text: "x" });
    expect(expandTemplate("a\\nb", m)).toBe("a\nb");
    expect(expandTemplate("a\\rb", m)).toBe("a\rb");
    expect(expandTemplate("a\\tb", m)).toBe("a\tb");
  });

  it("leaves other backslash escapes as literal backslash", () => {
    const m = makeMatch({ text: "x" });
    expect(expandTemplate("\\x", m)).toBe("\\x");
    expect(expandTemplate("\\\\", m)).toBe("\\\\");
  });

  it("mixes $-refs and \\n escapes", () => {
    const m = makeMatch({
      text: "foo",
      groups: [{ index: 0, end: 3, text: "foo" }],
    });
    expect(expandTemplate("$1\\n$1", m)).toBe("foo\nfoo");
  });

  it("falls back to single-digit index when two-digit out of range", () => {
    const m = makeMatch({
      text: "x",
      groups: [{ index: 0, end: 1, text: "A" }],
    });
    expect(expandTemplate("$12", m)).toBe("A2");
  });
});
