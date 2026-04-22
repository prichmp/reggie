export type RegexTokenKind =
  | "literal"
  | "metachar"
  | "charclass"
  | "group-open"
  | "group-close"
  | "quantifier"
  | "anchor"
  | "escape"
  | "alternation"
  | "flag"
  | "error";

export interface RegexToken {
  kind: RegexTokenKind;
  text: string;
  start: number;
  end: number;
}

export interface MatchGroup {
  name?: string;
  index: number;
  end: number;
  text: string | null;
}

export interface MatchResult {
  index: number;
  end: number;
  text: string;
  groups: MatchGroup[];
}
