import type { MatchResult } from "../types";
import { expandTemplate } from "./expandTemplate";

export function applyList(matches: MatchResult[], template: string): string {
  if (matches.length === 0) return "";
  let out = "";
  for (const m of matches) {
    out += expandTemplate(template, m);
  }
  return out;
}
