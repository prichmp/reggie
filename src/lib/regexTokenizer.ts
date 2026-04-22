import type { RegexToken, RegexTokenKind } from "../types";

const ANCHOR_CHARS = new Set(["^", "$"]);
const QUANTIFIER_STARTS = new Set(["*", "+", "?", "{"]);

export function tokenizeRegex(source: string): RegexToken[] {
  const tokens: RegexToken[] = [];
  let i = 0;
  const groupStack: number[] = [];

  const push = (kind: RegexTokenKind, start: number, end: number) => {
    tokens.push({ kind, text: source.slice(start, end), start, end });
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === "\\") {
      const start = i;
      if (i + 1 >= source.length) {
        push("error", start, i + 1);
        i += 1;
        continue;
      }
      const next = source[i + 1];
      if (next === "k" && source[i + 2] === "<") {
        const close = source.indexOf(">", i + 3);
        if (close === -1) {
          push("error", start, source.length);
          i = source.length;
        } else {
          push("escape", start, close + 1);
          i = close + 1;
        }
      } else if (/[0-9]/.test(next)) {
        let j = i + 2;
        while (j < source.length && /[0-9]/.test(source[j])) j++;
        push("escape", start, j);
        i = j;
      } else if (next === "x") {
        const end = Math.min(i + 4, source.length);
        push("escape", start, end);
        i = end;
      } else if (next === "u") {
        if (source[i + 2] === "{") {
          const close = source.indexOf("}", i + 3);
          const end = close === -1 ? source.length : close + 1;
          push("escape", start, end);
          i = end;
        } else {
          const end = Math.min(i + 6, source.length);
          push("escape", start, end);
          i = end;
        }
      } else {
        push("escape", start, i + 2);
        i += 2;
      }
      continue;
    }

    if (ch === "[") {
      const start = i;
      let j = i + 1;
      if (source[j] === "^") j++;
      // allow ']' as literal if first char of class
      if (source[j] === "]") j++;
      let closed = false;
      while (j < source.length) {
        if (source[j] === "\\" && j + 1 < source.length) {
          j += 2;
          continue;
        }
        if (source[j] === "]") {
          closed = true;
          j++;
          break;
        }
        j++;
      }
      if (!closed) {
        push("error", start, source.length);
        i = source.length;
      } else {
        push("charclass", start, j);
        i = j;
      }
      continue;
    }

    if (ch === "(") {
      const start = i;
      let end = i + 1;
      // Handle (?: (?= (?! (?<= (?<! (?<name>
      if (source[i + 1] === "?") {
        const c2 = source[i + 2];
        if (c2 === ":" || c2 === "=" || c2 === "!") {
          end = i + 3;
        } else if (c2 === "<") {
          const c3 = source[i + 3];
          if (c3 === "=" || c3 === "!") {
            end = i + 4;
          } else {
            const close = source.indexOf(">", i + 3);
            if (close === -1) {
              push("error", start, source.length);
              i = source.length;
              continue;
            }
            end = close + 1;
          }
        } else {
          end = i + 2;
        }
      }
      push("group-open", start, end);
      groupStack.push(start);
      i = end;
      continue;
    }

    if (ch === ")") {
      if (groupStack.length === 0) {
        push("error", i, i + 1);
      } else {
        groupStack.pop();
        push("group-close", i, i + 1);
      }
      i += 1;
      continue;
    }

    if (ch === "|") {
      push("alternation", i, i + 1);
      i += 1;
      continue;
    }

    if (ANCHOR_CHARS.has(ch)) {
      push("anchor", i, i + 1);
      i += 1;
      continue;
    }

    if (QUANTIFIER_STARTS.has(ch)) {
      if (ch === "{") {
        const close = source.indexOf("}", i + 1);
        if (close === -1) {
          push("literal", i, i + 1);
          i += 1;
          continue;
        }
        const inside = source.slice(i + 1, close);
        if (/^\d+(,\d*)?$/.test(inside)) {
          let end = close + 1;
          if (source[end] === "?") end++;
          push("quantifier", i, end);
          i = end;
        } else {
          push("literal", i, i + 1);
          i += 1;
        }
        continue;
      }
      let end = i + 1;
      if (source[end] === "?") end++;
      push("quantifier", i, end);
      i = end;
      continue;
    }

    if (ch === ".") {
      push("metachar", i, i + 1);
      i += 1;
      continue;
    }

    push("literal", i, i + 1);
    i += 1;
  }

  if (groupStack.length > 0) {
    for (const unclosed of groupStack) {
      for (const token of tokens) {
        if (token.start === unclosed && token.kind === "group-open") {
          token.kind = "error";
        }
      }
    }
  }

  return tokens;
}
