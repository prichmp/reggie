import type { MatchResult } from "../types";
import { expandTemplate } from "./expandTemplate";

export function applyReplace(
  subject: string,
  matches: MatchResult[],
  template: string,
  global: boolean,
): string {
  if (matches.length === 0) return subject;
  const effective = global ? matches : matches.slice(0, 1);
  let out = "";
  let cursor = 0;
  for (const m of effective) {
    if (m.index < cursor) continue;
    out += subject.slice(cursor, m.index);
    out += expandTemplate(template, m);
    cursor = m.end;
  }
  out += subject.slice(cursor);
  return out;
}
