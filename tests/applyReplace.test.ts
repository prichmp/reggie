import { describe, expect, it } from "vitest";
import { applyReplace } from "../src/lib/applyReplace";
import { compileRegex, runRegex } from "../src/lib/runRegex";

describe("applyReplace", () => {
  it("returns subject unchanged when no matches", () => {
    const subject = "nothing to see";
    expect(applyReplace(subject, [], "X", true)).toBe(subject);
  });

  it("replaces all matches when global", () => {
    const re = compileRegex("\\d+", "");
    const subject = "a1 b22 c333";
    const matches = runRegex(re, subject);
    expect(applyReplace(subject, matches, "#", true)).toBe("a# b# c#");
  });

  it("replaces only first match when not global", () => {
    const re = compileRegex("\\d+", "");
    const subject = "a1 b22 c333";
    const matches = runRegex(re, subject);
    expect(applyReplace(subject, matches, "#", false)).toBe("a# b22 c333");
  });

  it("uses expandTemplate semantics ($&, $n, $<name>)", () => {
    const re = compileRegex("(?<k>\\w+)=(\\d+)", "");
    const subject = "a=1 b=22";
    const matches = runRegex(re, subject);
    expect(applyReplace(subject, matches, "$<k>:$2", true)).toBe("a:1 b:22");
  });

  it("does not support $` or $'", () => {
    const re = compileRegex("x", "");
    const subject = "axb";
    const matches = runRegex(re, subject);
    expect(applyReplace(subject, matches, "$`", true)).toBe("a$`b");
  });
});
