import { describe, expect, it } from "vitest";
import { applyList } from "../src/lib/applyList";
import { compileRegex, runRegex } from "../src/lib/runRegex";

describe("applyList", () => {
  it("returns empty string when no matches", () => {
    expect(applyList([], "x")).toBe("");
  });

  it("concatenates expanded templates without a separator", () => {
    const re = compileRegex("(\\w+)=(\\d+)", "");
    const subject = "a=1 b=22 c=333";
    const matches = runRegex(re, subject);
    expect(applyList(matches, "$1:$2;")).toBe("a:1;b:22;c:333;");
  });

  it("lets users opt into newlines via \\n in the template", () => {
    const re = compileRegex("\\d+", "");
    const subject = "1 2 3";
    const matches = runRegex(re, subject);
    expect(applyList(matches, "$&\\n")).toBe("1\n2\n3\n");
  });

  it("supports multiline-looking templates via \\n escape", () => {
    const re = compileRegex("(\\w+)", "");
    const subject = "a b";
    const matches = runRegex(re, subject);
    expect(applyList(matches, "- $1\\n")).toBe("- a\n- b\n");
  });
});
