import { useEffect, useRef, useState } from "react";
import type { MatchResult } from "../types";
import {
  RegexEngine,
  type EngineStatus,
  type RegexRequest,
} from "../lib/regexEngine";

export interface UseRegexEngineResult {
  matches: MatchResult[];
  status: EngineStatus;
  error: string | null;
}

/**
 * Runs regex matching in a Web Worker.
 *
 * Pass `null` when there is no valid regex to run; this clears matches without
 * touching the worker. The worker is created once for the component's lifetime
 * and terminated on unmount (StrictMode-safe: the dev double-mount terminates
 * the first worker before the second is created).
 */
export function useRegexEngine(request: RegexRequest | null): UseRegexEngineResult {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<RegexEngine | null>(null);

  useEffect(() => {
    const engine = new RegexEngine(
      () =>
        new Worker(new URL("../workers/regex.worker.ts", import.meta.url), {
          type: "module",
        }),
      {
        onResult: (r) => {
          setMatches(r.matches);
          setError(r.error);
        },
        onStatus: setStatus,
      },
    );
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (request === null) {
      setMatches([]);
      setStatus("idle");
      setError(null);
      return;
    }
    engine.request(request);
    // `request` is fully determined by these fields, so we depend on them
    // rather than the object identity (which changes every render). Do not let
    // an exhaustive-deps autofix replace this with `[request]`.
  }, [request === null, request?.pattern, request?.flags, request?.subject]);

  return { matches, status, error };
}
