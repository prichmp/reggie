/// <reference lib="webworker" />
import { compileRegex, runRegex } from "../lib/runRegex";
import type { MatchResult } from "../types";

export interface RegexRequestMessage {
  id: number;
  pattern: string;
  flags: string;
  subject: string;
}

export interface RegexResponseMessage {
  id: number;
  ok: boolean;
  matches?: MatchResult[];
  error?: string;
}

// `self` is typed as `Window` because the project compiles with the DOM lib;
// cast to the worker scope so postMessage has the single-argument signature.
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<RegexRequestMessage>) => {
  const { id, pattern, flags, subject } = ev.data;
  try {
    const regex = compileRegex(pattern, flags);
    const matches = runRegex(regex, subject);
    const res: RegexResponseMessage = { id, ok: true, matches };
    ctx.postMessage(res);
  } catch (e) {
    const res: RegexResponseMessage = {
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    ctx.postMessage(res);
  }
};
