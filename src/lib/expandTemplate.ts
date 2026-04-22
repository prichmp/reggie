import type { MatchResult } from "../types";

export function expandTemplate(template: string, match: MatchResult): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === "\\" && i + 1 < template.length) {
      const next = template[i + 1];
      if (next === "n" || next === "r" || next === "t") {
        out += next === "n" ? "\n" : next === "r" ? "\r" : "\t";
        i += 2;
        continue;
      }
    }
    if (ch !== "$" || i + 1 >= template.length) {
      out += ch;
      i += 1;
      continue;
    }
    const next = template[i + 1];
    if (next === "$") {
      out += "$";
      i += 2;
      continue;
    }
    if (next === "&") {
      out += match.text;
      i += 2;
      continue;
    }
    if (next === "<") {
      const close = template.indexOf(">", i + 2);
      if (close === -1) {
        out += ch;
        i += 1;
        continue;
      }
      const name = template.slice(i + 2, close);
      const group = match.groups.find((g) => g.name === name);
      if (group && group.text !== null) {
        out += group.text;
      }
      i = close + 1;
      continue;
    }
    if (/[0-9]/.test(next)) {
      // Greedy but capped at two digits; prefer 2-digit index when it exists.
      let digits = next;
      if (i + 2 < template.length && /[0-9]/.test(template[i + 2])) {
        const twoDigit = digits + template[i + 2];
        const twoIdx = parseInt(twoDigit, 10);
        if (twoIdx >= 1 && twoIdx <= match.groups.length) {
          digits = twoDigit;
        }
      }
      const idx = parseInt(digits, 10);
      if (idx >= 1 && idx <= match.groups.length) {
        const group = match.groups[idx - 1];
        if (group && group.text !== null) out += group.text;
        i += 1 + digits.length;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}
