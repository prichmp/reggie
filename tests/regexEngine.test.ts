import { describe, expect, it } from "vitest";
import {
  RegexEngine,
  type EngineResult,
  type EngineStatus,
  type WorkerLike,
} from "../src/lib/regexEngine";
import type {
  RegexRequestMessage,
  RegexResponseMessage,
} from "../src/workers/regex.worker";
import type { MatchResult } from "../src/types";

const M: MatchResult = { index: 0, end: 1, text: "a", groups: [] };

class FakeWorker implements WorkerLike {
  onmessage: ((ev: MessageEvent<RegexResponseMessage>) => void) | null = null;
  posted: RegexRequestMessage[] = [];
  terminated = false;

  postMessage(message: RegexRequestMessage): void {
    this.posted.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  /** Simulate the worker posting a result back. */
  respond(res: RegexResponseMessage): void {
    this.onmessage?.({ data: res } as MessageEvent<RegexResponseMessage>);
  }
}

/** Manually-controlled timers so timeout behavior is deterministic. */
function makeTimers() {
  const handles: Array<{ id: number; fn: () => void; live: boolean }> = [];
  let next = 1;
  return {
    setTimer: (fn: () => void) => {
      const id = next++;
      handles.push({ id, fn, live: true });
      return id;
    },
    clearTimer: (h: unknown) => {
      const found = handles.find((x) => x.id === h);
      if (found) found.live = false;
    },
    fireLast: () => {
      for (let i = handles.length - 1; i >= 0; i--) {
        if (handles[i].live) {
          handles[i].live = false;
          handles[i].fn();
          return;
        }
      }
      throw new Error("no live timer to fire");
    },
    liveCount: () => handles.filter((x) => x.live).length,
  };
}

function setup(timeoutMs = 1000) {
  const workers: FakeWorker[] = [];
  const results: EngineResult[] = [];
  const statuses: EngineStatus[] = [];
  const timers = makeTimers();
  const engine = new RegexEngine(
    () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    {
      onResult: (r) => results.push(r),
      onStatus: (s) => statuses.push(s),
    },
    { timeoutMs, setTimer: timers.setTimer, clearTimer: timers.clearTimer },
  );
  return { engine, workers, results, statuses, timers };
}

const REQ = { pattern: "a", flags: "", subject: "aaa" };

describe("RegexEngine", () => {
  it("delivers a successful result and returns to idle", () => {
    const { engine, workers, results, statuses } = setup();
    engine.request(REQ);

    expect(workers).toHaveLength(1);
    expect(workers[0].posted[0]).toMatchObject({ id: 1, pattern: "a", subject: "aaa" });
    expect(statuses.at(-1)).toBe("computing");

    workers[0].respond({ id: 1, ok: true, matches: [M] });

    expect(results.at(-1)).toEqual({ ok: true, matches: [M], error: null });
    expect(statuses.at(-1)).toBe("idle");
  });

  it("reports an error result with empty matches", () => {
    const { engine, workers, results } = setup();
    engine.request(REQ);
    workers[0].respond({ id: 1, ok: false, error: "bad" });
    expect(results.at(-1)).toEqual({ ok: false, matches: [], error: "bad" });
  });

  it("ignores a stale result from a superseded request", () => {
    const { engine, workers, results } = setup();
    engine.request(REQ); // id 1, worker 0
    engine.request({ ...REQ, subject: "bbb" }); // busy -> kill worker 0, spawn worker 1, id 2

    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1].posted[0]).toMatchObject({ id: 2, subject: "bbb" });

    // Late reply from the killed worker must be dropped.
    workers[0].respond({ id: 1, ok: true, matches: [M] });
    expect(results).toHaveLength(0);

    workers[1].respond({ id: 2, ok: true, matches: [] });
    expect(results).toHaveLength(1);
    expect(results[0].matches).toEqual([]);
  });

  it("terminates a busy worker to abort a runaway computation", () => {
    const { engine, workers } = setup();
    engine.request(REQ);
    expect(workers[0].terminated).toBe(false);
    engine.request(REQ); // arrives while busy
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1].terminated).toBe(false);
  });

  it("times out, aborts the worker, and surfaces a too-slow state", () => {
    const { engine, workers, results, statuses, timers } = setup(100);
    engine.request(REQ);
    expect(timers.liveCount()).toBe(1);

    timers.fireLast();

    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2); // respawned for the next request
    expect(statuses.at(-1)).toBe("too-slow");
    expect(results.at(-1)).toEqual({ ok: false, matches: [], error: "Regex timed out" });

    // A late reply carrying the aborted id is ignored.
    workers[0].respond({ id: 1, ok: true, matches: [M] });
    expect(results).toHaveLength(1);
  });

  it("clears the timeout once a result arrives", () => {
    const { engine, workers, timers } = setup();
    engine.request(REQ);
    expect(timers.liveCount()).toBe(1);
    workers[0].respond({ id: 1, ok: true, matches: [M] });
    expect(timers.liveCount()).toBe(0);
  });

  it("terminates the worker on dispose", () => {
    const { engine, workers } = setup();
    engine.dispose();
    expect(workers[0].terminated).toBe(true);
  });
});
