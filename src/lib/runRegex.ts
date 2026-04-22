import type { MatchGroup, MatchResult } from "../types";

export const MAX_MATCHES = 10_000;

export function compileRegex(pattern: string, userFlags: string): RegExp {
  const required = new Set(userFlags.split(""));
  required.add("g");
  required.add("d");
  // dedupe while preserving a stable order
  const flags = Array.from(required).join("");
  return new RegExp(pattern, flags);
}

export function runRegex(regex: RegExp, subject: string): MatchResult[] {
  const results: MatchResult[] = [];
  if (!subject) return results;
  // matchAll requires a global flag; compileRegex guarantees it.
  const iter = subject.matchAll(regex);
  for (const m of iter) {
    if (m.index === undefined) continue;
    const start = m.index;
    const end = start + m[0].length;

    const indices = (m as RegExpMatchArray & {
      indices?: Array<[number, number] | undefined> & {
        groups?: Record<string, [number, number] | undefined>;
      };
    }).indices;

    const namedIndices = indices?.groups;
    const nameByIndex: Record<number, string> = {};
    if (m.groups && indices && namedIndices) {
      for (const [name, range] of Object.entries(namedIndices)) {
        if (!range) continue;
        for (let g = 1; g < indices.length; g++) {
          const r = indices[g];
          if (r && r[0] === range[0] && r[1] === range[1]) {
            nameByIndex[g] = name;
            break;
          }
        }
      }
    }

    const groups: MatchGroup[] = [];
    for (let g = 1; g < m.length; g++) {
      const text = m[g];
      const range = indices?.[g];
      if (text === undefined || !range) {
        groups.push({ name: nameByIndex[g], index: -1, end: -1, text: null });
      } else {
        groups.push({ name: nameByIndex[g], index: range[0], end: range[1], text });
      }
    }

    results.push({ index: start, end, text: m[0], groups });

    if (results.length >= MAX_MATCHES) break;
  }
  return results;
}
